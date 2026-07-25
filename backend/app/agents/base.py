import asyncio
import json
import logging
from typing import Any, Callable, Coroutine
from app.adapters.gemini import GeminiAdapter
from app.models.schemas import AgentOutput

logger = logging.getLogger(__name__)

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "agent": {"type": "string"},
        "department": {"type": "string"},
        "decision": {"type": "string"},
        "reasoning_summary": {"type": "string"},
        "evidence": {"type": "string"},
        "requested_action": {"type": "string"},
        "confidence": {"type": "number"},
        "requires_escalation": {"type": "boolean"},
        "message_to_department": {"type": "string"},
        "requested_amount": {"type": "number"},
    },
    "required": [
        "agent", "department", "decision", "reasoning_summary",
        "evidence", "requested_action", "confidence",
        "requires_escalation",
    ],
}


class BaseAgent:
    def __init__(self, name: str, department: str, role: str, responsibilities: str):
        self.name = name
        self.department = department
        self.role = role
        self.responsibilities = responsibilities
        self.gemini = GeminiAdapter()

    def build_system_prompt(self) -> str:
        return (
            f"You are {self.name}, the {self.role} of the {self.department} department.\n"
            f"Your responsibilities: {self.responsibilities}\n"
            f"You must respond with valid JSON matching the provided schema.\n"
            f"Be concise and professional."
        )

    def build_context(self, incident: dict, workflow_state: str, **extras) -> str:
        ctx = f"Incident: {json.dumps(incident, indent=2)}\n"
        ctx += f"Current Workflow State: {workflow_state}\n"
        for key, val in extras.items():
            ctx += f"{key}: {json.dumps(val, indent=2) if isinstance(val, (dict, list)) else val}\n"

        if workflow_state == "FINANCE_REVIEW":
            ctx += "\nIMPORTANT: The autonomous spending limit is $50,000. If the requested amount exceeds this limit, you MUST set requires_escalation to true — human approval is required per policy.\n"
        elif workflow_state == "FINANCE_REEVALUATION":
            ctx += "\nIMPORTANT: Even after appeal review, if the requested amount still exceeds the $50,000 autonomous spending limit, you MUST set requires_escalation to true. Only set requires_escalation to false if the amount is within policy limits.\n"
        elif workflow_state == "ENGINEERING_APPEAL":
            ctx += "\nThe finance department has rejected your resource request because it exceeds policy limits. Provide a strong cost-benefit justification for why this exception should be approved despite exceeding the standard limit.\n"
        elif workflow_state == "ENGINEERING_ANALYSIS":
            ctx += "\nAssess the incident. Determine if this is a simple code-level fix (like a syntax error in a file) or a standard infrastructure incident.\n"
            ctx += "\nIf this is a SIMPLE CODE FIX (syntax error, typo, missing import, etc.):\n"
            ctx += "- Set decision to 'CODE_FIX'\n"
            ctx += "- Set requested_action to 'AUTO_FIX'\n"
            ctx += "- Set requested_amount to 0\n"
            ctx += "- Put the ENTIRE corrected file content in the evidence field\n"
            ctx += "- Set confidence to at least 0.5 if you are confident in the fix\n"
            ctx += "\nOtherwise, follow the standard process:\n"
            ctx += "Set requested_amount to the actual dollar cost needed to resolve this incident. Be realistic:\n"
            ctx += "- For critical P0 outages requiring infrastructure scaling or emergency vendor contracts: $60,000-$120,000\n"
            ctx += "- For P1 incidents requiring moderate engineering effort or third-party tools: $20,000-$60,000\n"
            ctx += "- For P2 issues fixable with config changes, hotfixes, or minor infra adjustments: $5,000-$30,000\n"
            ctx += "- For P3/P4 low-severity issues: $1,000-$10,000\n"
            ctx += "The autonomous spending limit is $50,000. If your request exceeds this, Finance will reject it and require human approval.\n"

        return ctx

    async def think(
        self, incident: dict, workflow_state: str, *,
        emit_event: Callable[[str, str, str, dict], Coroutine] | None = None,
        workflow_id: str = "",
        **extras
    ) -> AgentOutput | None:
        system_prompt = self.build_system_prompt()
        user_prompt = self.build_context(incident, workflow_state, **extras)

        if emit_event and workflow_id:
            await emit_event("AGENT_THINKING_STARTED", workflow_id, self.name, {
                "agent": self.name,
                "department": self.department,
                "workflow_state": workflow_state,
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            })

        streaming_tokens: list[str] = []
        async def on_token(token: str):
            streaming_tokens.append(token)
            if emit_event and workflow_id:
                await emit_event("AGENT_THINKING_TOKEN", workflow_id, self.name, {
                    "agent": self.name,
                    "token": token,
                    "accumulated": "".join(streaming_tokens),
                })

        result = await self.gemini.generate_structured(
            system_prompt, user_prompt, OUTPUT_SCHEMA,
            on_token=on_token if emit_event and workflow_id else None,
        )

        if result:
            logger.info(f"{self.name} completed via Gemini for state {workflow_state}")
            agent_output = AgentOutput(
                agent=result.get("agent", self.name),
                department=result.get("department", self.department),
                decision=result.get("decision", ""),
                reasoning_summary=result.get("reasoning_summary", ""),
                evidence=result.get("evidence", ""),
                requested_action=result.get("requested_action", ""),
                confidence=result.get("confidence", 0.0),
                requires_escalation=result.get("requires_escalation", False),
                message_to_department=result.get("message_to_department"),
                requested_amount=result.get("requested_amount", 0.0),
            )
            if emit_event and workflow_id:
                await emit_event("AGENT_THINKING_COMPLETED", workflow_id, self.name, {
                    "agent": self.name,
                    "output": agent_output.model_dump(),
                    "tokens": "".join(streaming_tokens) if streaming_tokens else None,
                })
            return agent_output

        logger.error(f"Gemini returned no result for {self.name} in state {workflow_state}. No fallback available.")
        if emit_event and workflow_id:
            await emit_event("AGENT_THINKING_FAILED", workflow_id, self.name, {
                "agent": self.name,
                "error": f"Gemini returned no result for state {workflow_state}",
            })
        return None
