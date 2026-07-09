import pytest
from app.models.schemas import AgentOutput


def test_agent_output_schema():
    data = {
        "agent": "EngineeringAgent",
        "department": "Engineering",
        "decision": "Emergency scaling required",
        "reasoning_summary": "P0 incident needs immediate resources",
        "evidence": "Revenue loss ₹4L/day",
        "requested_action": "Request ₹80,000 for infrastructure",
        "confidence": 0.85,
        "requires_escalation": False,
        "message_to_department": "Need approval for scaling",
    }
    output = AgentOutput(**data)
    assert output.agent == "EngineeringAgent"
    assert output.confidence == 0.85


def test_agent_output_without_optional():
    data = {
        "agent": "FinanceAgent",
        "department": "Finance",
        "decision": "Rejected",
        "reasoning_summary": "Exceeds limit",
        "evidence": "Policy limit is 50000",
        "requested_action": "Escalate",
        "confidence": 0.95,
        "requires_escalation": True,
    }
    output = AgentOutput(**data)
    assert output.message_to_department is None
