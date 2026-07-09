import json
import logging
from typing import Any
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
        return ctx

    async def think(self, incident: dict, workflow_state: str, **extras) -> AgentOutput | None:
        system_prompt = self.build_system_prompt()
        user_prompt = self.build_context(incident, workflow_state, **extras)
        result = await self.gemini.generate_structured(system_prompt, user_prompt, OUTPUT_SCHEMA)
        if result:
            return AgentOutput(
                agent=result.get("agent", self.name),
                department=result.get("department", self.department),
                decision=result.get("decision", ""),
                reasoning_summary=result.get("reasoning_summary", ""),
                evidence=result.get("evidence", ""),
                requested_action=result.get("requested_action", ""),
                confidence=result.get("confidence", 0.0),
                requires_escalation=result.get("requires_escalation", False),
                message_to_department=result.get("message_to_department"),
            )
        return None
