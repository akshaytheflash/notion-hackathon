import json
import logging
from typing import Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select, delete
from app.models.database import async_session
from app.models.workflow import Workflow, WorkflowEvent, IntegrationAction, ApprovalTracking
from app.models.schemas import IncidentCreate, WorkflowResponse, WorkflowEventResponse, ApprovalResponse
from app.config import settings
from app.core.orchestrator import Orchestrator
from app.adapters.notion import NotionAdapter

logger = logging.getLogger(__name__)
router = APIRouter()
orchestrator = Orchestrator()
notion = NotionAdapter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/api/admin/clear-database")
async def clear_database():
    async with async_session() as session:
        await session.execute(delete(WorkflowEvent))
        await session.execute(delete(IntegrationAction))
        await session.execute(delete(ApprovalTracking))
        await session.execute(delete(Workflow))
        await session.commit()
    return {"status": "ok", "message": "All workflow data cleared"}


@router.get("/api/integrations/status")
async def integrations_status():
    return settings.integrations_status


@router.get("/api/notion/schema-status")
async def notion_schema_status():
    status = await notion.validate_schemas()
    return status


@router.post("/api/incidents")
async def create_incident(body: IncidentCreate):
    result = await orchestrator.create_incident(body.name, body.severity, body.description, body.revenue_risk_per_day)
    return result


@router.get("/api/incidents")
async def list_incidents():
    async with async_session() as session:
        result = await session.execute(select(Workflow).order_by(Workflow.created_at.desc()))
        workflows = result.scalars().all()
        return [
            {
                "workflow_id": w.id,
                "incident_id": w.incident_id,
                "state": w.state,
                "created_at": w.created_at.isoformat(),
            }
            for w in workflows
        ]


@router.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str):
    async with async_session() as session:
        result = await session.execute(select(Workflow).where(Workflow.incident_id == incident_id))
        w = result.scalar_one_or_none()
        if not w:
            raise HTTPException(404, "Incident not found")
        return {
            "workflow_id": w.id,
            "incident_id": w.incident_id,
            "state": w.state,
            "context": json.loads(w.context_json or "{}"),
            "created_at": w.created_at.isoformat(),
        }


@router.get("/api/workflows")
async def list_workflows():
    async with async_session() as session:
        result = await session.execute(select(Workflow).order_by(Workflow.created_at.desc()))
        workflows = result.scalars().all()
        return [WorkflowResponse(
            id=w.id,
            incident_id=w.incident_id,
            state=w.state,
            pending_approval_id=w.pending_approval_id,
            created_at=w.created_at,
            updated_at=w.updated_at,
            completed_at=w.completed_at,
        ) for w in workflows]


@router.get("/api/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    async with async_session() as session:
        w = await session.get(Workflow, workflow_id)
        if not w:
            raise HTTPException(404, "Workflow not found")
        return WorkflowResponse(
            id=w.id,
            incident_id=w.incident_id,
            state=w.state,
            pending_approval_id=w.pending_approval_id,
            created_at=w.created_at,
            updated_at=w.updated_at,
            completed_at=w.completed_at,
        )


@router.get("/api/workflows/{workflow_id}/events")
async def get_workflow_events(workflow_id: str):
    async with async_session() as session:
        result = await session.execute(
            select(WorkflowEvent).where(WorkflowEvent.workflow_id == workflow_id).order_by(WorkflowEvent.created_at)
        )
        events = result.scalars().all()
        return [WorkflowEventResponse(
            id=e.id,
            workflow_id=e.workflow_id,
            event_type=e.event_type,
            source=e.source,
            payload_json=json.loads(e.payload_json or "{}"),
            created_at=e.created_at,
        ) for e in events]


@router.get("/api/approvals")
async def list_approvals():
    async with async_session() as session:
        result = await session.execute(select(ApprovalTracking).order_by(ApprovalTracking.created_at.desc()))
        approvals = result.scalars().all()
        return [ApprovalResponse(
            id=a.id,
            workflow_id=a.workflow_id,
            approval_id=a.approval_id,
            last_known_status=a.last_known_status,
            processed=a.processed,
        ) for a in approvals]


DECISION_EVENT_TYPES = {
    "ENGINEERING_ANALYSIS_COMPLETED",
    "FINANCE_DECISION_CREATED",
    "ENGINEERING_APPEAL_CREATED",
    "OPERATIONS_REVIEW_COMPLETED",
}


@router.get("/api/decisions")
async def list_decisions():
    async with async_session() as session:
        result = await session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.event_type.in_(DECISION_EVENT_TYPES))
            .order_by(WorkflowEvent.created_at.desc())
        )
        events = result.scalars().all()
        return [WorkflowEventResponse(
            id=e.id,
            workflow_id=e.workflow_id,
            event_type=e.event_type,
            source=e.source,
            payload_json=json.loads(e.payload_json or "{}"),
            created_at=e.created_at,
        ) for e in events]


@router.get("/api/policies")
async def list_policies():
    async with async_session() as session:
        result = await session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.event_type == "POLICY_EVALUATED")
            .order_by(WorkflowEvent.created_at.desc())
        )
        events = result.scalars().all()
        return [WorkflowEventResponse(
            id=e.id,
            workflow_id=e.workflow_id,
            event_type=e.event_type,
            source=e.source,
            payload_json=json.loads(e.payload_json or "{}"),
            created_at=e.created_at,
        ) for e in events]


@router.get("/api/policies/active")
async def list_active_policies():
    try:
        policies = await notion.get_active_policies()
        if policies:
            return policies
    except Exception as e:
        logger.warning(f"Failed to fetch policies from Notion: {e}")
    
    return [{
        "id": "POLICY-001",
        "properties": {
            "Name": {"title": [{"text": {"content": "AUTONOMOUS_SPENDING_LIMIT"}}]},
            "Policy ID": {"rich_text": [{"text": {"content": "POLICY-001"}}]},
            "Department": {"select": {"name": "Engineering"}},
            "Policy Type": {"select": {"name": "SPENDING_LIMIT"}},
            "Limit": {"number": 50000},
            "Required Action": {"select": {"name": "HUMAN_APPROVAL_REQUIRED"}},
            "Active": {"checkbox": True}
        }
    }]


@router.post("/api/policies")
async def create_policy(body: dict):
    return {
        "id": f"POLICY-{body.get('policy_id', '001')}",
        "properties": {
            "Name": {"title": [{"text": {"content": body.get('name', 'Unnamed Policy')}}]},
            "Policy ID": {"rich_text": [{"text": {"content": body.get('policy_id', 'POLICY-001')}}]},
            "Department": {"select": {"name": body.get('department', 'Engineering')}},
            "Policy Type": {"select": {"name": body.get('policy_type', 'SPENDING_LIMIT')}},
            "Limit": {"number": body.get('limit', 50000)},
            "Required Action": {"select": {"name": body.get('required_action', 'HUMAN_APPROVAL_REQUIRED')}},
            "Active": {"checkbox": body.get('active', True)}
        }
    }


@router.get("/api/action-log")
async def list_action_log():
    async with async_session() as session:
        result = await session.execute(
            select(WorkflowEvent).order_by(WorkflowEvent.created_at.desc())
        )
        events = result.scalars().all()
        return [WorkflowEventResponse(
            id=e.id,
            workflow_id=e.workflow_id,
            event_type=e.event_type,
            source=e.source,
            payload_json=json.loads(e.payload_json or "{}"),
            created_at=e.created_at,
        ) for e in events]


@router.post("/api/demo/seed")
async def demo_seed():
    return {"status": "ok", "message": "Schema configured in Notion"}


@router.post("/api/demo/run-primary-scenario")
async def run_primary_scenario(body: IncidentCreate | None = None):
    data = body.model_dump() if body else None
    result = await orchestrator.run_primary_scenario(incident_data=data)
    return result


@router.post("/api/workflows/{workflow_id}/retry-failed-actions")
async def retry_failed_actions(workflow_id: str):
    return {"status": "not_implemented", "workflow_id": workflow_id}


@router.websocket("/ws/workflows/{workflow_id}")
async def workflow_ws(websocket: WebSocket, workflow_id: str):
    await websocket.accept()
    async def send_event(event):
        try:
            await websocket.send_json({
                "event_type": event.event_type,
                "source": event.source,
                "payload": json.loads(event.payload_json or "{}"),
                "created_at": event.created_at.isoformat(),
            })
        except Exception:
            pass

    orchestrator.on_event(send_event)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        # Without this, every socket that ever connects stays registered forever,
        # leaking listeners (and re-sending to dead sockets) for the life of the process.
        if send_event in orchestrator._event_listeners:
            orchestrator._event_listeners.remove(send_event)
