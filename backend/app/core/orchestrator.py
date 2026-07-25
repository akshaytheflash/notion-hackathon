import asyncio
import json
import uuid
import logging
import traceback
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import async_session
from app.models.workflow import Workflow, WorkflowEvent, IntegrationAction, ApprovalTracking, NotificationRecipient
from app.models.schemas import AgentOutput, PolicyResult
from app.core.state_machine import validate_transition, InvalidTransitionError, STATES
from app.core.policy_engine import evaluate_spending_limit
from app.agents.engineering import EngineeringAgent
from app.agents.finance import FinanceAgent
from app.agents.operations import OperationsAgent
from app.adapters.notion import NotionAdapter
from app.adapters.github import GitHubAdapter
from app.adapters.slack import SlackAdapter
from app.adapters.pagerduty import PagerDutyAdapter
from app.adapters.email import EmailAdapter
from app.core.auto_fixer import AutoFixer

logger = logging.getLogger(__name__)


class Orchestrator:
    def __init__(self):
        self.engineering = EngineeringAgent()
        self.finance = FinanceAgent()
        self.operations = OperationsAgent()
        self.notion = NotionAdapter()
        self.github = GitHubAdapter()
        self.slack = SlackAdapter()
        self.pagerduty = PagerDutyAdapter()
        self.email = EmailAdapter()
        self.auto_fixer = AutoFixer()
        self._event_listeners: list = []

    def on_event(self, listener) -> None:
        self._event_listeners.append(listener)

    async def _emit_event(self, event_type: str, workflow_id: str, source: str, payload: dict) -> None:
        async with async_session() as session:
            event = WorkflowEvent(
                workflow_id=workflow_id,
                event_type=event_type,
                source=source,
                payload_json=json.dumps(payload, default=str),
            )
            session.add(event)
            await session.commit()
            await session.refresh(event)
        for listener in self._event_listeners:
            await listener(event)

    async def _transition(self, session: AsyncSession, workflow: Workflow, target: str) -> None:
        validate_transition(workflow.state, target)
        from_state = workflow.state
        workflow.state = target
        workflow.updated_at = datetime.now(timezone.utc)
        if target in ("COMPLETED", "REJECTED", "FAILED"):
            workflow.completed_at = datetime.now(timezone.utc)
        session.add(workflow)
        await session.commit()
        await self._emit_event(f"STATE_{target}", workflow.id, "orchestrator", {"from": from_state, "to": target})

    async def create_incident(self, name: str, severity: str, description: str, revenue_risk_per_day: float) -> dict:
        workflow_id = str(uuid.uuid4())
        incident_id = str(uuid.uuid4())

        async with async_session() as session:
            workflow = Workflow(id=workflow_id, incident_id=incident_id, state="CREATED")
            context = {
                "name": name,
                "severity": severity,
                "description": description,
                "revenue_risk_per_day": revenue_risk_per_day,
                "incident_id": incident_id,
            }
            workflow.context_json = json.dumps(context, default=str)
            session.add(workflow)
            await session.commit()

        await self._emit_event("INCIDENT_CREATED", workflow_id, "system", context)
        await self._transition(await self._get_session(), workflow, "ENGINEERING_ANALYSIS")

        try:
            await self.notion.create_incident(incident_id, name, severity, description, revenue_risk_per_day, workflow_id)
        except Exception as e:
            logger.warning(f"Notion incident creation failed (non-blocking): {e}")
        await self.slack.send_notification(f"🚨 P0 Incident Created: {name}\nID: {incident_id[:8]}\nRevenue Risk: ₹{revenue_risk_per_day:,.0f}/day")
        await self.pagerduty.trigger_incident(
            title=f"[{severity}] {name}",
            description=f"Revenue Risk: ₹{revenue_risk_per_day:,.0f}/day\n{description}",
            severity=severity,
            dedup_key=f"incident-{incident_id}",
        )

        return {"workflow_id": workflow_id, "incident_id": incident_id}

    async def _get_session(self):
        async with async_session() as s:
            return s

    async def _load_workflow(self, workflow_id: str) -> Workflow | None:
        async with async_session() as session:
            result = await session.execute(select(Workflow).where(Workflow.id == workflow_id))
            return result.scalar_one_or_none()

    async def _policy_check(self, requested_amount: float, workflow_id: str) -> PolicyResult | None:
        policies = await self.notion.get_active_policies()
        if not policies:
            logger.warning("No active policies found, using default")
            policy = {"properties": {"Limit": {"type": "number", "number": 50000}, "Required Action": {"type": "select", "select": {"name": "HUMAN_APPROVAL_REQUIRED"}}}}
            result = evaluate_spending_limit(policy, requested_amount)
        else:
            policy = policies[0]
            result = evaluate_spending_limit(policy, requested_amount)

        await self._emit_event("POLICY_EVALUATED", workflow_id, "policy_engine", result.model_dump())
        return result

    async def run_primary_scenario(self, incident_data: dict | None = None) -> dict:
        if incident_data is None:
            incident_data = {
                "name": "P0 Production Outage - Payment Gateway",
                "severity": "P0",
                "description": "Critical payment gateway failure affecting all transactions. Emergency infrastructure scaling required.",
                "revenue_risk_per_day": 400000.0,
            }

        result = await self.create_incident(**incident_data)
        workflow_id = result["workflow_id"]

        workflow = await self._load_workflow(workflow_id)

        async with async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow:
                return {"error": "workflow not found"}

            context = json.loads(workflow.context_json or "{}")

            eng_output = await self.engineering.think(
                context, workflow.state, workflow_id=workflow_id, emit_event=self._emit_event,
            )
            if not eng_output:
                logger.error(f"Engineering analysis returned None for workflow {workflow_id}")
                await self._transition(session, workflow, "FAILED")
                return {"workflow_id": workflow_id, "status": "FAILED", "error": "Engineering analysis failed"}

            await self._emit_event("ENGINEERING_ANALYSIS_COMPLETED", workflow_id, "engineering", eng_output.model_dump())
            await self.notion.record_decision(str(uuid.uuid4()), workflow_id, context.get("incident_id", ""),
                                                eng_output.agent, eng_output.department, eng_output.decision,
                                                eng_output.reasoning_summary, eng_output.evidence, eng_output.confidence)

            is_code_fix = (
                eng_output.decision == "CODE_FIX"
                and eng_output.requested_action == "AUTO_FIX"
                and eng_output.evidence
                and eng_output.confidence >= 0.5
            )
            if is_code_fix:
                file_path = context.get("file_path", context.get("description", "")).lower()
                import re
                py_files = re.findall(r'[\w-]+\.py', file_path)
                target_file = py_files[0] if py_files else "test.py"
                logger.info(f"Engineering detected code fix for {target_file}. Routing to auto-fixer.")
                await self._emit_event("ROUTING_TO_AUTOFIX", workflow_id, "orchestrator", {
                    "file_path": target_file,
                    "incident": context.get("description", ""),
                })
                fix_result = await self.auto_fixer.run_auto_fix(
                    issue_description=context.get("description", "Code fix needed"),
                    file_path=target_file,
                    trace_id=workflow_id,
                )
                await self._emit_event("AUTOFIX_WORKFLOW_RESULT", workflow_id, "orchestrator", fix_result)
                if fix_result.get("status") in ("FIXED_AND_MERGED", "ALREADY_FIXED"):
                    await self._transition(session, workflow, "COMPLETED")
                else:
                    await self._transition(session, workflow, "FAILED")
                return {"workflow_id": workflow_id, "status": fix_result.get("status", "FAILED"), "auto_fix_result": fix_result}

            await self._transition(session, workflow, "RESOURCE_REQUESTED")
            await asyncio.sleep(5)
            requested_amount = eng_output.requested_amount if eng_output.requested_amount > 0 else 80000.0
            context["requested_amount"] = requested_amount
            workflow.context_json = json.dumps(context, default=str)
            session.add(workflow)
            await session.commit()

            await self._emit_event("RESOURCE_REQUEST_CREATED", workflow_id, "engineering", {"amount": requested_amount})

            await self._transition(session, workflow, "FINANCE_REVIEW")
            policy_result = await self._policy_check(requested_amount, workflow_id)

            fin_output = await self.finance.think(
                context, workflow.state,
                policy_result=policy_result.model_dump(),
                engineering_message=eng_output.message_to_department,
                workflow_id=workflow_id, emit_event=self._emit_event,
            )
            if not fin_output:
                logger.error(f"Finance review returned None for workflow {workflow_id}. Gemini call likely failed.")
                await self._transition(session, workflow, "FAILED")
                return {"workflow_id": workflow_id, "status": "FAILED", "error": "Finance review failed - check backend logs for Gemini error"}

            await self._emit_event("FINANCE_DECISION_CREATED", workflow_id, "finance", fin_output.model_dump())
            await self.notion.record_decision(str(uuid.uuid4()), workflow_id, context.get("incident_id", ""),
                                                fin_output.agent, fin_output.department, fin_output.decision,
                                                fin_output.reasoning_summary, fin_output.evidence, fin_output.confidence)

            if not policy_result.passed:
                await self._transition(session, workflow, "FINANCE_REJECTED")
                await self.slack.send_notification(
                    f"❌ Finance rejected autonomous execution.\n"
                    f"Workflow: {workflow_id[:8]}\n"
                    f"Amount: ₹{requested_amount:,.0f} exceeds limit of ₹{policy_result.limit:,.0f}"
                )

                await self._transition(session, workflow, "ENGINEERING_APPEAL")
                await asyncio.sleep(5)
                appeal_output = await self.engineering.think(
                    context, workflow.state,
                    policy_result=policy_result.model_dump(),
                    finance_decision=fin_output.model_dump(),
                    workflow_id=workflow_id, emit_event=self._emit_event,
                )
                if not appeal_output:
                    await self._transition(session, workflow, "FAILED")
                    return {"workflow_id": workflow_id, "status": "FAILED", "error": "Engineering appeal failed"}

                await self._emit_event("ENGINEERING_APPEAL_CREATED", workflow_id, "engineering", appeal_output.model_dump())
                await self.notion.record_decision(str(uuid.uuid4()), workflow_id, context.get("incident_id", ""),
                                                    appeal_output.agent, appeal_output.department, appeal_output.decision,
                                                    appeal_output.reasoning_summary, appeal_output.evidence, appeal_output.confidence)

                await self._transition(session, workflow, "FINANCE_REEVALUATION")
                await asyncio.sleep(5)
                reeval_output = await self.finance.think(
                    context, workflow.state,
                    policy_result=policy_result.model_dump(),
                    appeal=appeal_output.model_dump(),
                    workflow_id=workflow_id, emit_event=self._emit_event,
                )
                if not reeval_output:
                    await self._transition(session, workflow, "FAILED")
                    return {"workflow_id": workflow_id, "status": "FAILED", "error": "Finance reevaluation failed"}

                if reeval_output.requires_escalation:
                    await self._transition(session, workflow, "APPROVAL_REQUIRED")
                    await self._create_approval(session, workflow, context, requested_amount, eng_output, fin_output)
                    return {"workflow_id": workflow_id, "status": "WAITING_FOR_APPROVAL", "incident_id": context.get("incident_id")}
                else:
                    await self._transition(session, workflow, "REJECTED")
                    await self.slack.send_notification(f"❌ Workflow {workflow_id[:8]} rejected by Finance.")
                    return {"workflow_id": workflow_id, "status": "REJECTED"}
            else:
                await self._transition(session, workflow, "APPROVED")
                return await self._execute_approved(workflow.id, context)
        return {"workflow_id": workflow_id, "status": "UNKNOWN"}

    async def _create_approval(self, session: AsyncSession, workflow: Workflow, context: dict, amount: float,
                                eng: AgentOutput, fin: AgentOutput) -> None:
        approval_id = str(uuid.uuid4())
        await self._transition(session, workflow, "WAITING_FOR_APPROVAL")
        context["approval_id"] = approval_id
        workflow.pending_approval_id = approval_id
        workflow.context_json = json.dumps(context, default=str)
        session.add(workflow)
        await session.commit()

        tracking = ApprovalTracking(workflow_id=workflow.id, approval_id=approval_id, last_known_status="PENDING")
        session.add(tracking)
        await session.commit()

        await self._emit_event("APPROVAL_REQUEST_CREATED", workflow.id, "orchestrator",
                                {"approval_id": approval_id, "amount": amount})
        await self._emit_event("WORKFLOW_PAUSED", workflow.id, "orchestrator", {})

        notion_result = await self.notion.create_approval(
            approval_id, workflow.id, context.get("incident_id", ""),
            eng.agent, amount,
            f"Requested: ₹{amount:,.0f}\n"
            f"Revenue Risk: ₹{context.get('revenue_risk_per_day', 0):,.0f}/day\n"
            f"Engineering: {eng.reasoning_summary}\n"
            f"Finance: {fin.reasoning_summary}",
        )
        if notion_result is None:
            logger.warning(
                f"Notion approval page creation failed for approval {approval_id[:8]} "
                f"(workflow {workflow.id[:8]}). The approval watcher will not be able to "
                f"resolve this approval automatically. Manual intervention required."
            )
        else:
            logger.info(
                f"Notion approval page created for approval {approval_id[:8]}: "
                f"{notion_result.get('id', 'unknown')}"
            )
        await self.slack.send_notification(
            f"⏸️ Workflow Paused - Human Approval Required\n"
            f"Workflow: {workflow.id[:8]}\n"
            f"Amount: ₹{amount:,.0f}\n"
            f"Revenue Risk: ₹{context.get('revenue_risk_per_day', 0):,.0f}/day"
        )

    async def _run_idempotent_action(self, session: AsyncSession, workflow_id: str, action_type: str,
                                       idempotency_key: str, coro_factory) -> dict | None:
        """Runs an external side-effect (GitHub issue, etc.) at most once per idempotency_key.

        If an IntegrationAction row already recorded a SUCCESS for this key, the cached
        external_reference is returned without re-invoking the side effect. This protects
        against duplicate GitHub issues / Slack posts if a workflow step is retried or
        replayed (e.g. approval_watcher firing twice, or a crash-and-resume).
        """
        existing = await session.execute(
            select(IntegrationAction).where(IntegrationAction.idempotency_key == idempotency_key)
        )
        action = existing.scalar_one_or_none()
        if action and action.status == "SUCCESS":
            logger.info(f"Idempotent hit for '{idempotency_key}', reusing prior result")
            return json.loads(action.external_reference) if action.external_reference else None

        if action is None:
            action = IntegrationAction(
                workflow_id=workflow_id,
                action_type=action_type,
                idempotency_key=idempotency_key,
                status="PENDING",
            )
            session.add(action)
            await session.commit()
            await session.refresh(action)

        result = None
        try:
            result = await coro_factory()
            action.status = "SUCCESS" if result is not None else "FAILED"
            action.external_reference = json.dumps(result, default=str) if result is not None else None
            action.error = None if result is not None else "adapter returned no result"
        except Exception as e:
            action.status = "FAILED"
            action.error = str(e)
            logger.error(f"Idempotent action '{idempotency_key}' raised: {e}")

        session.add(action)
        await session.commit()
        return result

    async def _send_completion_emails(self, workflow: Workflow, context: dict) -> None:
        try:
            async with async_session() as session:
                result = await session.execute(select(NotificationRecipient))
                recipients = result.scalars().all()
            if not recipients:
                logger.info("No notification recipients configured — skipping email")
                return
            to_emails = [r.email for r in recipients if r.email]
            if not to_emails:
                logger.info("No valid email addresses in recipients — skipping email")
                return
            logger.info(f"Sending completion email to {to_emails} for workflow {workflow.id[:8]}")
            incident_data = {
                **context,
                "workflow_id": workflow.id,
                "completed_at": workflow.completed_at.isoformat() if workflow.completed_at else "",
            }
            await self.email.send_incident_summary(to_emails, incident_data)
        except Exception as e:
            logger.error(f"Failed to send completion emails for workflow {workflow.id[:8]}: {traceback.format_exc()}")

    async def _execute_approved(self, workflow_id: str, context: dict) -> dict:
        async with async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow:
                return {"error": "workflow not found for execution"}
            await self._transition(session, workflow, "EXECUTING")
            await self.slack.send_notification(f"✅ Workflow {workflow.id[:8]} approved. Executing...")

            issue_body = (
                f"Incident ID: {context.get('incident_id', 'N/A')}\n"
                f"Workflow ID: {workflow.id}\n"
                f"Severity: {context.get('severity', 'P0')}\n"
                f"Approved Budget: ₹{context.get('requested_amount', 0):,.0f}\n"
                f"Revenue Risk Per Day: ₹{context.get('revenue_risk_per_day', 0):,.0f}\n"
                f"Description: {context.get('description', '')}\n"
            )
            idempotency_key = f"github:create_issue:{workflow.id}"
            issue_title = f"[{context.get('severity', 'P0')}] {context.get('name', 'Emergency infrastructure scaling')}"
            issue = await self._run_idempotent_action(
                session, workflow.id, "github_create_issue", idempotency_key,
                lambda: self.github.create_issue(
                    idempotency_key,
                    issue_title,
                    issue_body,
                ),
            )

            await self._emit_event("GITHUB_ISSUE_CREATED", workflow.id, "github", issue or {"error": "failed"})

            await self._transition(session, workflow, "OPERATIONS_REVIEW")
            await asyncio.sleep(5)

            ops_output = await self.operations.think(
                context, workflow.state, github_result=issue,
                workflow_id=workflow_id, emit_event=self._emit_event,
            )
            await self._emit_event("OPERATIONS_REVIEW_COMPLETED", workflow.id, "operations",
                                    ops_output.model_dump() if ops_output else {})

            await self._transition(session, workflow, "COMPLETED")
            await self.slack.send_notification(f"✅ Workflow {workflow.id[:8]} completed successfully.")
        await self._send_completion_emails(workflow, context)
        return {"workflow_id": workflow.id, "status": "COMPLETED", "github_issue": issue}

    async def resume_approved_workflow(self, workflow_id: str) -> dict:
        async with async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow:
                return {"error": "workflow not found"}
            if workflow.state != "WAITING_FOR_APPROVAL":
                return {"error": f"workflow in state {workflow.state}, not WAITING_FOR_APPROVAL"}

            context = json.loads(workflow.context_json or "{}")
            await self._emit_event("APPROVAL_APPROVED", workflow_id, "approval_watcher", {})
            await self._transition(session, workflow, "APPROVED")
        return await self._execute_approved(workflow_id, context)

    async def pause_workflow(self, workflow_id: str) -> dict:
        async with async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow:
                return {"error": "workflow not found"}
            if workflow.state in ("COMPLETED", "FAILED", "CANCELLED", "PAUSED"):
                return {"error": f"cannot pause workflow in state {workflow.state}"}
            from_state = workflow.state
            await self._transition(session, workflow, "PAUSED")
            await self._emit_event("WORKFLOW_PAUSED", workflow_id, "system",
                                    {"from": from_state})
        return {"workflow_id": workflow_id, "status": "PAUSED"}

    async def resume_workflow(self, workflow_id: str) -> dict:
        async with async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow:
                return {"error": "workflow not found"}
            if workflow.state != "PAUSED":
                return {"error": f"workflow in state {workflow.state}, not PAUSED"}
            await self._emit_event("WORKFLOW_RESUMED", workflow_id, "system", {})
        return {"workflow_id": workflow_id, "status": "RESUMED"}

    async def cancel_workflow(self, workflow_id: str) -> dict:
        async with async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow:
                return {"error": "workflow not found"}
            if workflow.state in ("COMPLETED", "FAILED", "CANCELLED"):
                return {"error": f"cannot cancel workflow in state {workflow.state}"}
            await self._transition(session, workflow, "CANCELLED")
            await self._emit_event("WORKFLOW_CANCELLED", workflow_id, "system", {})
        return {"workflow_id": workflow_id, "status": "CANCELLED"}

    async def resume_rejected_workflow(self, workflow_id: str) -> dict:
        async with async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow:
                return {"error": "workflow not found"}
            if workflow.state != "WAITING_FOR_APPROVAL":
                return {"error": f"workflow in state {workflow.state}, not WAITING_FOR_APPROVAL"}

            await self._emit_event("APPROVAL_REJECTED", workflow_id, "approval_watcher", {})
            await self._transition(session, workflow, "REJECTED")
            await self._transition(session, workflow, "COMPLETED")
            await self.slack.send_notification(f"❌ Workflow {workflow_id[:8]} rejected by human.")

            context = json.loads(workflow.context_json or "{}")
        await self._send_completion_emails(workflow, context)
        return {"workflow_id": workflow_id, "status": "REJECTED"}
