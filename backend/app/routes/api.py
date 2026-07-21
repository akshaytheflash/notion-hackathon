import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select, delete
from app.models.database import async_session
from app.models.workflow import Workflow, WorkflowEvent, IntegrationAction, ApprovalTracking, StoredPolicy
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
        await session.execute(delete(StoredPolicy))
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
async def list_incidents(page: int = 1, pageSize: int = 50):
    async with async_session() as session:
        count_result = await session.execute(select(Workflow))
        total = len(count_result.scalars().all())
        result = await session.execute(
            select(Workflow)
            .order_by(Workflow.created_at.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        workflows = result.scalars().all()
        return {
            "data": [
                {
                    "workflow_id": w.id,
                    "incident_id": w.incident_id,
                    "state": w.state,
                    "created_at": w.created_at.isoformat(),
                }
                for w in workflows
            ],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }


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
async def list_workflows(page: int = 1, pageSize: int = 50):
    async with async_session() as session:
        count_result = await session.execute(select(Workflow))
        total = len(count_result.scalars().all())
        result = await session.execute(
            select(Workflow)
            .order_by(Workflow.created_at.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        workflows = result.scalars().all()
        return {
            "data": [WorkflowResponse(
                id=w.id,
                incident_id=w.incident_id,
                state=w.state,
                pending_approval_id=w.pending_approval_id,
                created_at=w.created_at,
                updated_at=w.updated_at,
                completed_at=w.completed_at,
            ) for w in workflows],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }


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
async def get_workflow_events(workflow_id: str, page: int = 1, pageSize: int = 100):
    async with async_session() as session:
        count_result = await session.execute(
            select(WorkflowEvent).where(WorkflowEvent.workflow_id == workflow_id)
        )
        total = len(count_result.scalars().all())
        result = await session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.workflow_id == workflow_id)
            .order_by(WorkflowEvent.created_at)
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        events = result.scalars().all()
        return {
            "data": [WorkflowEventResponse(
                id=e.id,
                workflow_id=e.workflow_id,
                event_type=e.event_type,
                source=e.source,
                payload_json=json.loads(e.payload_json or "{}"),
                created_at=e.created_at,
            ) for e in events],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }


@router.post("/api/approvals/{approval_id}/approve")
async def approve_approval(approval_id: str):
    async with async_session() as session:
        result = await session.execute(
            select(ApprovalTracking).where(ApprovalTracking.approval_id == approval_id)
        )
        tracking = result.scalar_one_or_none()
        if not tracking:
            raise HTTPException(404, "Approval not found")
        if tracking.processed:
            raise HTTPException(400, "Approval already processed")
        if tracking.last_known_status != "PENDING":
            raise HTTPException(400, f"Approval in status {tracking.last_known_status}, not PENDING")

        tracking.last_known_status = "APPROVED"
        tracking.processed = True
        session.add(tracking)
        await session.commit()

    result = await orchestrator.resume_approved_workflow(tracking.workflow_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return {
        "id": tracking.id,
        "workflow_id": tracking.workflow_id,
        "approval_id": tracking.approval_id,
        "last_known_status": "APPROVED",
        "processed": True,
    }


@router.post("/api/approvals/{approval_id}/reject")
async def reject_approval(approval_id: str):
    async with async_session() as session:
        result = await session.execute(
            select(ApprovalTracking).where(ApprovalTracking.approval_id == approval_id)
        )
        tracking = result.scalar_one_or_none()
        if not tracking:
            raise HTTPException(404, "Approval not found")
        if tracking.processed:
            raise HTTPException(400, "Approval already processed")
        if tracking.last_known_status != "PENDING":
            raise HTTPException(400, f"Approval in status {tracking.last_known_status}, not PENDING")

        tracking.last_known_status = "REJECTED"
        tracking.processed = True
        session.add(tracking)
        await session.commit()

    result = await orchestrator.resume_rejected_workflow(tracking.workflow_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return {
        "id": tracking.id,
        "workflow_id": tracking.workflow_id,
        "approval_id": tracking.approval_id,
        "last_known_status": "REJECTED",
        "processed": True,
    }


@router.get("/api/approvals")
async def list_approvals(page: int = 1, pageSize: int = 50):
    async with async_session() as session:
        count_result = await session.execute(select(ApprovalTracking))
        total = len(count_result.scalars().all())
        result = await session.execute(
            select(ApprovalTracking)
            .order_by(ApprovalTracking.created_at.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        approvals = result.scalars().all()
        return {
            "data": [ApprovalResponse(
                id=a.id,
                workflow_id=a.workflow_id,
                approval_id=a.approval_id,
                last_known_status=a.last_known_status,
                processed=a.processed,
            ) for a in approvals],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }


DECISION_EVENT_TYPES = {
    "ENGINEERING_ANALYSIS_COMPLETED",
    "FINANCE_DECISION_CREATED",
    "ENGINEERING_APPEAL_CREATED",
    "OPERATIONS_REVIEW_COMPLETED",
}


@router.get("/api/decisions")
async def list_decisions(page: int = 1, pageSize: int = 50):
    async with async_session() as session:
        count_result = await session.execute(
            select(WorkflowEvent).where(WorkflowEvent.event_type.in_(DECISION_EVENT_TYPES))
        )
        total = len(count_result.scalars().all())
        result = await session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.event_type.in_(DECISION_EVENT_TYPES))
            .order_by(WorkflowEvent.created_at.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        events = result.scalars().all()
        return {
            "data": [WorkflowEventResponse(
                id=e.id,
                workflow_id=e.workflow_id,
                event_type=e.event_type,
                source=e.source,
                payload_json=json.loads(e.payload_json or "{}"),
                created_at=e.created_at,
            ) for e in events],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }


@router.get("/api/policies")
async def list_policies(page: int = 1, pageSize: int = 50):
    async with async_session() as session:
        count_result = await session.execute(
            select(WorkflowEvent).where(WorkflowEvent.event_type == "POLICY_EVALUATED")
        )
        total = len(count_result.scalars().all())
        result = await session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.event_type == "POLICY_EVALUATED")
            .order_by(WorkflowEvent.created_at.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        events = result.scalars().all()
        return {
            "data": [WorkflowEventResponse(
                id=e.id,
                workflow_id=e.workflow_id,
                event_type=e.event_type,
                source=e.source,
                payload_json=json.loads(e.payload_json or "{}"),
                created_at=e.created_at,
            ) for e in events],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }


@router.get("/api/policies/active")
async def list_active_policies():
    policies = []
    try:
        notion_policies = await notion.get_active_policies()
        if notion_policies:
            policies.extend(notion_policies)
    except Exception as e:
        logger.warning(f"Failed to fetch policies from Notion: {e}")

    async with async_session() as session:
        result = await session.execute(
            select(StoredPolicy).where(StoredPolicy.active == True).order_by(StoredPolicy.created_at.desc())
        )
        stored = result.scalars().all()
        for p in stored:
            policies.append({
                "id": p.id,
                "properties": {
                    "Name": {"title": [{"text": {"content": p.name}}]},
                    "Policy ID": {"rich_text": [{"text": {"content": p.policy_id}}]},
                    "Department": {"select": {"name": p.department}},
                    "Policy Type": {"select": {"name": p.policy_type}},
                    "Limit": {"number": p.limit},
                    "Required Action": {"select": {"name": p.required_action}},
                    "Active": {"checkbox": p.active}
                }
            })

    if not policies:
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
    return policies


@router.post("/api/policies")
async def create_policy(body: dict):
    async with async_session() as session:
        policy = StoredPolicy(
            policy_id=body.get("policy_id", f"POLICY-{str(uuid.uuid4())[:8]}"),
            name=body.get("name", "Unnamed Policy"),
            department=body.get("department", "Engineering"),
            policy_type=body.get("policy_type", "SPENDING_LIMIT"),
            limit=body.get("limit", 50000),
            required_action=body.get("required_action", "HUMAN_APPROVAL_REQUIRED"),
            active=body.get("active", True),
        )
        session.add(policy)
        await session.commit()
        await session.refresh(policy)

    return {
        "id": policy.id,
        "properties": {
            "Name": {"title": [{"text": {"content": policy.name}}]},
            "Policy ID": {"rich_text": [{"text": {"content": policy.policy_id}}]},
            "Department": {"select": {"name": policy.department}},
            "Policy Type": {"select": {"name": policy.policy_type}},
            "Limit": {"number": policy.limit},
            "Required Action": {"select": {"name": policy.required_action}},
            "Active": {"checkbox": policy.active}
        }
    }


@router.get("/api/search")
async def search(q: str = ""):
    if not q or len(q.strip()) < 1:
        return {"incidents": [], "workflows": [], "decisions": [], "policies": [], "events": []}

    term = q.strip().lower()
    results = {"incidents": [], "workflows": [], "decisions": [], "policies": [], "events": []}

    async with async_session() as session:
        wf_result = await session.execute(select(Workflow).order_by(Workflow.created_at.desc()))
        for w in wf_result.scalars().all():
            ctx = json.loads(w.context_json or "{}")
            searchable = f"{w.id} {w.incident_id} {w.state} {ctx.get('name', '')} {ctx.get('description', '')}".lower()
            if term in searchable:
                results["workflows"].append({
                    "id": w.id,
                    "incident_id": w.incident_id,
                    "state": w.state,
                    "name": ctx.get("name", ""),
                    "created_at": w.created_at.isoformat(),
                })

        for w in results["workflows"]:
            results["incidents"].append({
                "workflow_id": w["id"],
                "incident_id": w["incident_id"],
                "state": w["state"],
                "name": w["name"],
                "created_at": w["created_at"],
            })

        dec_result = await session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.event_type.in_(DECISION_EVENT_TYPES))
            .order_by(WorkflowEvent.created_at.desc())
        )
        for e in dec_result.scalars().all():
            payload = json.loads(e.payload_json or "{}")
            searchable = f"{e.event_type} {payload.get('agent', '')} {payload.get('department', '')} {payload.get('decision', '')} {payload.get('reasoning_summary', '')}".lower()
            if term in searchable:
                results["decisions"].append({
                    "id": e.id,
                    "workflow_id": e.workflow_id,
                    "event_type": e.event_type,
                    "payload": payload,
                    "created_at": e.created_at.isoformat(),
                })

        pol_result = await session.execute(
            select(StoredPolicy).order_by(StoredPolicy.created_at.desc())
        )
        for p in pol_result.scalars().all():
            searchable = f"{p.policy_id} {p.name} {p.department} {p.policy_type} {p.required_action}".lower()
            if term in searchable:
                results["policies"].append({
                    "id": p.id,
                    "policy_id": p.policy_id,
                    "name": p.name,
                    "department": p.department,
                    "limit": p.limit,
                })

        ev_result = await session.execute(
            select(WorkflowEvent).order_by(WorkflowEvent.created_at.desc()).limit(500)
        )
        for e in ev_result.scalars().all():
            payload = json.loads(e.payload_json or "{}")
            searchable = f"{e.event_type} {e.source} {json.dumps(payload)}".lower()
            if term in searchable:
                results["events"].append({
                    "id": e.id,
                    "workflow_id": e.workflow_id,
                    "event_type": e.event_type,
                    "source": e.source,
                    "created_at": e.created_at.isoformat(),
                })

    return results


@router.get("/api/action-log")
async def list_action_log(page: int = 1, pageSize: int = 100):
    async with async_session() as session:
        count_result = await session.execute(select(WorkflowEvent))
        total = len(count_result.scalars().all())
        result = await session.execute(
            select(WorkflowEvent)
            .order_by(WorkflowEvent.created_at.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        events = result.scalars().all()
        return {
            "data": [WorkflowEventResponse(
                id=e.id,
                workflow_id=e.workflow_id,
                event_type=e.event_type,
                source=e.source,
                payload_json=json.loads(e.payload_json or "{}"),
                created_at=e.created_at,
            ) for e in events],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }


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
    async with async_session() as session:
        wf = await session.get(Workflow, workflow_id)
        if not wf:
            raise HTTPException(404, "Workflow not found")

        result = await session.execute(
            select(IntegrationAction).where(
                IntegrationAction.workflow_id == workflow_id,
                IntegrationAction.status == "FAILED",
            )
        )
        failed_actions = result.scalars().all()
        if not failed_actions:
            raise HTTPException(400, "No failed actions to retry for this workflow")

        retried = []
        for action in failed_actions:
            action.status = "PENDING"
            action.error = None
            action.updated_at = datetime.now(timezone.utc)
            session.add(action)
            retried.append(action.id)

        await session.commit()

    await orchestrator._emit_event(
        "ACTIONS_RETRY_REQUESTED", workflow_id, "system",
        {"retried_action_ids": retried, "count": len(retried)}
    )
    return {"status": "retrying", "workflow_id": workflow_id, "retried_count": len(retried)}


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
