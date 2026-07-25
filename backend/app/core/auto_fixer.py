import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select

from app.models.database import async_session
from app.models.workflow import Workflow, WorkflowEvent, IntegrationAction
from app.models.schemas import AgentOutput
from app.agents.autofix import AutoFixAgent
from app.adapters.github import GitHubAdapter

logger = logging.getLogger(__name__)


class AutoFixError(Exception):
    pass


class AutoFixer:
    def __init__(self):
        self.agent = AutoFixAgent()
        self.github = GitHubAdapter()
        self._event_listeners: list = []

    def on_event(self, listener) -> None:
        self._event_listeners.append(listener)

    async def _emit_event(self, event_type: str, trace_id: str, source: str, payload: dict) -> None:
        async with async_session() as session:
            event = WorkflowEvent(
                workflow_id=trace_id,
                event_type=event_type,
                source=source,
                payload_json=json.dumps(payload, default=str),
            )
            session.add(event)
            await session.commit()
            await session.refresh(event)
        for listener in self._event_listeners:
            try:
                await listener(event)
            except Exception:
                pass

    async def run_auto_fix(self, issue_description: str, file_path: str, trace_id: str | None = None) -> dict:
        trace_id = trace_id or str(uuid.uuid4())

        await self._emit_event("AUTOFIX_STARTED", trace_id, "auto_fixer", {
            "issue_description": issue_description,
            "file_path": file_path,
        })

        try:
            incident_context = {
                "name": "Auto-Fix Incident",
                "severity": "P3",
                "description": issue_description,
                "revenue_risk_per_day": 0,
                "file_path": file_path,
            }

            await self._emit_event("AUTOFIX_ANALYZING", trace_id, "auto_fixer", {
                "issue": issue_description,
                "file": file_path,
            })

            agent_output = await self.agent.think(
                incident_context, "ENGINEERING_ANALYSIS",
                trace_id=trace_id, emit_event=self._emit_event,
            )

            if not agent_output:
                await self._emit_event("AUTOFIX_FAILED", trace_id, "auto_fixer", {
                    "error": "AutoFixAgent returned no result",
                    "issue": issue_description,
                })
                return {
                    "trace_id": trace_id,
                    "status": "FAILED",
                    "error": "AI agent could not analyze the issue. The AI service may be unavailable.",
                }

            can_fix = (
                agent_output.decision.upper() == "CAN_FIX"
                and agent_output.confidence >= 0.5
                and agent_output.evidence
            )

            if not can_fix:
                reason = agent_output.reasoning_summary or "No clear fix identified"
                logger.info(f"Auto-fix deemed too complex for '{file_path}': {reason}")
                await self._emit_event("AUTOFIX_COMPLEX", trace_id, "auto_fixer", {
                    "reason": reason,
                    "agent_decision": agent_output.decision,
                    "agent_confidence": agent_output.confidence,
                })
                return {
                    "trace_id": trace_id,
                    "status": "TOO_COMPLEX",
                    "reason": reason,
                    "agent_output": agent_output.model_dump(),
                }

            corrected_content = agent_output.evidence
            logger.info(f"Auto-fix identified fix for '{file_path}'. Attempting to apply...")

            await self._emit_event("AUTOFIX_SIMPLE", trace_id, "auto_fixer", {
                "file_path": file_path,
                "fix_description": agent_output.reasoning_summary,
            })

            return await self._apply_fix(file_path, corrected_content, trace_id, agent_output)

        except AutoFixError as e:
            logger.error(f"Auto-fix error for {file_path}: {e}")
            await self._emit_event("AUTOFIX_FAILED", trace_id, "auto_fixer", {"error": str(e)})
            return {"trace_id": trace_id, "status": "FAILED", "error": str(e)}
        except Exception as e:
            logger.exception(f"Unexpected auto-fix error for {file_path}: {e}")
            await self._emit_event("AUTOFIX_FAILED", trace_id, "auto_fixer", {"error": f"Unexpected error: {e}"})
            return {"trace_id": trace_id, "status": "FAILED", "error": f"An unexpected error occurred: {e}"}

    async def _apply_fix(self, file_path: str, corrected_content: str, trace_id: str, agent_output: AgentOutput) -> dict:
        branch_name = f"autofix/{file_path.replace('/', '-').replace('.py', '')}-{uuid.uuid4().hex[:8]}"

        try:
            existing_file = await self.github.get_file_content(file_path)
            if existing_file is None:
                raise AutoFixError(f"File '{file_path}' not found in repository")

            original_content = existing_file["content"]
            file_sha = existing_file["sha"]

            if original_content == corrected_content:
                await self._emit_event("AUTOFIX_COMPLEX", trace_id, "auto_fixer", {
                    "reason": "File content is already correct, no fix needed",
                })
                return {
                    "trace_id": trace_id,
                    "status": "ALREADY_FIXED",
                    "message": "File content is already correct, no changes needed.",
                }

            base_sha = await self.github.get_default_branch_sha()
            if not base_sha:
                raise AutoFixError("Could not determine base branch SHA")

            branch_ok = await self.github.create_branch(branch_name, base_sha)
            if not branch_ok:
                raise AutoFixError(f"Failed to create branch '{branch_name}'")

            await self._emit_event("AUTOFIX_BRANCH_CREATED", trace_id, "auto_fixer", {
                "branch": branch_name,
            })

            fix_msg = f"Auto-fix: {file_path} - {agent_output.reasoning_summary[:100]}"
            update_result = await self.github.create_or_update_file(
                path=file_path,
                content=corrected_content,
                message=fix_msg,
                sha=file_sha,
                branch=branch_name,
            )
            if update_result is None:
                raise AutoFixError("Failed to apply fix to file")

            await self._emit_event("AUTOFIX_FIXED", trace_id, "auto_fixer", {
                "file_path": file_path,
                "commit_sha": update_result.get("commit_sha", ""),
                "branch": branch_name,
            })

            pr_title = f"Auto-fix: {file_path} - {agent_output.reasoning_summary[:80]}"
            pr_body = (
                f"## Automated Fix\n\n"
                f"**File:** `{file_path}`\n\n"
                f"**Issue:** {agent_output.reasoning_summary}\n\n"
                f"**Confidence:** {agent_output.confidence:.2f}\n\n"
                f"---\n"
                f"_This fix was applied automatically by the Auto-Fix Agent._\n"
                f"_Trace ID: {trace_id}_\n"
            )
            pr_result = await self.github.create_pull_request(
                title=pr_title,
                body=pr_body,
                head=branch_name,
                base="main",
            )
            if pr_result is None:
                raise AutoFixError("Failed to create pull request")

            pr_number = pr_result["pr_number"]
            await self._emit_event("AUTOFIX_PR_CREATED", trace_id, "auto_fixer", {
                "pr_number": pr_number,
                "pr_url": pr_result["pr_url"],
            })

            merge_result = await self.github.merge_pull_request(
                pr_number=pr_number,
                commit_title=f"Auto-fix: {file_path} [trace: {trace_id[:8]}]",
            )
            if merge_result is None:
                merged = await self.github.check_pr_merged(pr_number)
                if not merged:
                    raise AutoFixError(f"PR #{pr_number} created but could not be merged automatically")

            await self._emit_event("AUTOFIX_MERGED", trace_id, "auto_fixer", {
                "pr_number": pr_number,
                "pr_url": pr_result["pr_url"],
                "merge_sha": merge_result.get("sha", "") if merge_result else "",
                "file_path": file_path,
                "branch": branch_name,
            })

            logger.info(f"Auto-fix complete: {file_path} via PR #{pr_number}")
            return {
                "trace_id": trace_id,
                "status": "FIXED_AND_MERGED",
                "file_path": file_path,
                "branch": branch_name,
                "pr_number": pr_number,
                "pr_url": pr_result["pr_url"],
                "fix_description": agent_output.reasoning_summary,
            }

        except AutoFixError:
            raise
        except Exception as e:
            raise AutoFixError(f"Failed to apply fix: {e}")
