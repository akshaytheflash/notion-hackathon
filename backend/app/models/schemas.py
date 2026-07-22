from pydantic import BaseModel, Field
from typing import Any
from datetime import datetime


class IncidentCreate(BaseModel):
    name: str
    severity: str = "P0"
    description: str = ""
    revenue_risk_per_day: float = 0.0


class IncidentResponse(BaseModel):
    incident_id: str
    name: str
    severity: str
    description: str
    revenue_risk_per_day: float
    status: str
    workflow_id: str
    created_at: str


class WorkflowResponse(BaseModel):
    id: str
    incident_id: str
    state: str
    pending_approval_id: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class WorkflowEventResponse(BaseModel):
    id: str
    workflow_id: str
    event_type: str
    source: str
    payload_json: Any
    created_at: datetime


class ApprovalResponse(BaseModel):
    id: str
    workflow_id: str
    approval_id: str
    last_known_status: str
    processed: bool
    notion_url: str = ""


class AgentOutput(BaseModel):
    agent: str
    department: str
    decision: str
    reasoning_summary: str
    evidence: str
    requested_action: str
    confidence: float
    requires_escalation: bool
    message_to_department: str | None = None
    requested_amount: float = 0.0


class PolicyResult(BaseModel):
    policy_id: str
    policy_name: str
    passed: bool
    requested_amount: float
    limit: float
    violation: str | None = None
    required_action: str | None = None
