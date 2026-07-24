import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select, delete, func
from app.models.database import async_session
from app.models.workflow import Workflow, WorkflowEvent, IntegrationAction, ApprovalTracking, StoredPolicy
from app.models.schemas import IncidentCreate, WorkflowResponse, WorkflowEventResponse, ApprovalResponse
from app.config import settings
from app.core.orchestrator import Orchestrator
from app.core.simulation_runner import SimulationRunner
from app.adapters.notion import NotionAdapter
from app.adapters.gemini import GeminiAdapter

logger = logging.getLogger(__name__)
router = APIRouter()
orchestrator = Orchestrator()
simulation_runner = SimulationRunner(orchestrator)
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


@router.post("/api/workflows/{workflow_id}/pause")
async def pause_workflow(workflow_id: str):
    return await orchestrator.pause_workflow(workflow_id)


@router.post("/api/workflows/{workflow_id}/resume")
async def resume_workflow(workflow_id: str):
    return await orchestrator.resume_workflow(workflow_id)


@router.post("/api/workflows/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    return await orchestrator.cancel_workflow(workflow_id)


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
        "notion_url": settings.notion_approvals_url,
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
        "notion_url": settings.notion_approvals_url,
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
        notion_url = settings.notion_approvals_url
        return {
            "data": [ApprovalResponse(
                id=a.id,
                workflow_id=a.workflow_id,
                approval_id=a.approval_id,
                last_known_status=a.last_known_status,
                processed=a.processed,
                notion_url=notion_url,
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

THINKING_EVENT_TYPES = {
    "AGENT_THINKING_STARTED",
    "AGENT_THINKING_TOKEN",
    "AGENT_THINKING_COMPLETED",
    "AGENT_THINKING_FAILED",
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


@router.get("/api/analytics/dashboard")
async def dashboard_analytics():
    async with async_session() as session:
        wf_result = await session.execute(select(Workflow).order_by(Workflow.created_at))
        workflows = wf_result.scalars().all()

        total = len(workflows)
        completed = [w for w in workflows if w.state == "COMPLETED" and w.completed_at]
        failed = [w for w in workflows if w.state in ("FAILED", "REJECTED")]
        active = [w for w in workflows if w.state not in ("COMPLETED", "FAILED", "REJECTED")]

        incidents_over_time: dict[str, int] = {}
        for w in workflows:
            day = w.created_at.strftime("%Y-%m-%d")
            incidents_over_time[day] = incidents_over_time.get(day, 0) + 1

        mttr_seconds = None
        if completed:
            total_ms = sum(
                (w.completed_at - w.created_at).total_seconds()
                for w in completed if w.completed_at
            )
            mttr_seconds = round(total_ms / len(completed), 1)

        revenue_at_risk = 0.0
        for w in workflows:
            ctx = json.loads(w.context_json or "{}")
            revenue_at_risk += ctx.get("revenue_risk_per_day", 0)

        ev_result = await session.execute(
            select(WorkflowEvent).where(WorkflowEvent.event_type == "POLICY_EVALUATED")
        )
        policy_evals = ev_result.scalars().all()
        policy_passed = 0
        policy_failed = 0
        for ev in policy_evals:
            payload = json.loads(ev.payload_json or "{}")
            if payload.get("passed"):
                policy_passed += 1
            else:
                policy_failed += 1

        confidences = []
        for et in ("ENGINEERING_ANALYSIS_COMPLETED", "FINANCE_DECISION_CREATED", "OPERATIONS_REVIEW_COMPLETED"):
            evr = await session.execute(
                select(WorkflowEvent).where(WorkflowEvent.event_type == et)
            )
            for ev in evr.scalars().all():
                payload = json.loads(ev.payload_json or "{}")
                conf = payload.get("confidence")
                if conf is not None:
                    confidences.append(round(conf, 2))

        sla_compliance = round((len(completed) / max(total, 1)) * 100, 1)

        return {
            "total_incidents": total,
            "active_incidents": len(active),
            "completed_incidents": len(completed),
            "failed_incidents": len(failed),
            "mttr_seconds": mttr_seconds,
            "revenue_at_risk": revenue_at_risk,
            "sla_compliance": sla_compliance,
            "policy_passed": policy_passed,
            "policy_failed": policy_failed,
            "confidence_scores": confidences,
            "incidents_over_time": [
                {"date": d, "count": c}
                for d, c in sorted(incidents_over_time.items())
            ],
        }


@router.get("/api/export/incidents.csv")
async def export_incidents_csv():
    async with async_session() as session:
        result = await session.execute(select(Workflow).order_by(Workflow.created_at.desc()))
        workflows = result.scalars().all()
        lines = ["workflow_id,incident_id,state,created_at,updated_at,completed_at,revenue_risk_per_day"]
        for w in workflows:
            ctx = json.loads(w.context_json or "{}")
            revenue = ctx.get("revenue_risk_per_day", 0)
            lines.append(
                f"{w.id},{w.incident_id},{w.state},{w.created_at.isoformat()},"
                f"{w.updated_at.isoformat()},{w.completed_at.isoformat() if w.completed_at else ''},{revenue}"
            )
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse("\n".join(lines), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=incidents.csv"})


@router.get("/api/export/incidents.pdf")
async def export_incidents_pdf():
    async with async_session() as session:
        result = await session.execute(select(Workflow).order_by(Workflow.created_at.desc()))
        workflows = result.scalars().all()
        rows = ""
        for w in workflows:
            ctx = json.loads(w.context_json or "{}")
            rows += f"""
            <tr>
                <td>{w.id[:8]}</td>
                <td>{w.incident_id[:8]}</td>
                <td>{w.state}</td>
                <td>{w.created_at.strftime('%Y-%m-%d %H:%M')}</td>
                <td>{w.completed_at.strftime('%Y-%m-%d %H:%M') if w.completed_at else '-'}</td>
                <td>${ctx.get('revenue_risk_per_day', 0):,.0f}</td>
            </tr>"""
        html = f"""<html><head><meta charset="utf-8"><title>Incident Report</title>
<style>
body {{ font-family: system-ui, sans-serif; padding: 40px; }}
h1 {{ color: #333; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }}
th {{ background: #f5f5f5; }}
.total {{ margin-top: 20px; font-weight: bold; }}
</style></head><body>
<h1>Incident Report</h1>
<p>Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
<p>Total incidents: {len(workflows)}</p>
<table><thead><tr><th>WF ID</th><th>Incident</th><th>State</th><th>Created</th><th>Completed</th><th>Revenue/Day</th></tr></thead><tbody>{rows}</tbody></table>
<p class="total">Total incidents: {len(workflows)}</p>
</body></html>"""
        from fastapi.responses import HTMLResponse
        return HTMLResponse(html, headers={"Content-Disposition": "attachment; filename=incidents.html"})


@router.get("/api/workflows/{workflow_id}/thinking")
async def get_workflow_thinking(workflow_id: str):
    async with async_session() as session:
        result = await session.execute(
            select(WorkflowEvent)
            .where(
                WorkflowEvent.workflow_id == workflow_id,
                WorkflowEvent.event_type.in_(THINKING_EVENT_TYPES),
            )
            .order_by(WorkflowEvent.created_at)
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
        }


@router.post("/api/demo/seed")
async def demo_seed():
    return {"status": "ok", "message": "Schema configured in Notion"}


@router.post("/api/demo/run-primary-scenario")
async def run_primary_scenario(body: IncidentCreate | None = None):
    data = body.model_dump() if body else None
    result = await orchestrator.run_primary_scenario(incident_data=data)
    return result


@router.post("/api/simulation/start")
async def start_simulation(count: int = 20, concurrency: int = 5, interval: float = 2.0):
    result = await simulation_runner.start_simulation(count, concurrency, interval)
    return result


@router.get("/api/simulations")
async def list_simulations():
    results = await simulation_runner.list_simulations()
    return {"data": results}


@router.get("/api/simulation/{sim_id}")
async def get_simulation(sim_id: str):
    result = await simulation_runner.get_status(sim_id)
    if not result:
        raise HTTPException(404, "Simulation not found")
    return result


@router.post("/api/simulation/{sim_id}/cancel")
async def cancel_simulation(sim_id: str):
    ok = await simulation_runner.cancel_simulation(sim_id)
    if not ok:
        raise HTTPException(404, "Simulation not found")
    return {"status": "cancelling", "simulation_id": sim_id}


@router.post("/api/simulation/{sim_id}/pause")
async def pause_simulation(sim_id: str):
    ok = await simulation_runner.pause_simulation(sim_id)
    if not ok:
        raise HTTPException(404, "Simulation not found")
    return {"status": "paused", "simulation_id": sim_id}


@router.post("/api/simulation/{sim_id}/resume")
async def resume_simulation(sim_id: str):
    ok = await simulation_runner.resume_simulation(sim_id)
    if not ok:
        raise HTTPException(404, "Simulation not found")
    return {"status": "resumed", "simulation_id": sim_id}


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


@router.post("/api/webhooks/generic")
async def webhook_receiver(payload: dict):
    event_type = payload.get("event_type", "WEBHOOK_RECEIVED")
    source = payload.get("source", "webhook")
    workflow_id = payload.get("workflow_id", "unknown")
    await orchestrator._emit_event(event_type, workflow_id, source, payload.get("data", payload))
    logger.info(f"Webhook received: {event_type} from {source}")
    return {"status": "ok", "event_type": event_type}


@router.post("/api/ai/query")
async def ai_query(body: dict):
    query = body.get("query", "")
    db_context = body.get("db_context", {})
    if not query:
        return {"answer": "Please provide a query."}
    gemini = GeminiAdapter()
    system_prompt = (
        "You are an AI assistant for the Enterprise AI OS Command Center. "
        "Given the current database state (workflows, incidents, decisions, policies, approvals, analytics), "
        "answer the user's question concisely and accurately. "
        "Use the JSON data provided to give specific, factual answers. "
        "If the data doesn't contain the answer, say so. "
        "Keep responses under 3 sentences for speech synthesis."
    )
    user_prompt = f"Database State:\n{json.dumps(db_context, indent=2)}\n\nUser Query: {query}"
    result = await gemini.generate_structured(system_prompt, user_prompt)
    if result is None:
        return {"answer": "I'm sorry, I couldn't process that query. The AI service may be unavailable."}
    return {"answer": result.get("text", "")}


@router.websocket("/ws/workflows/{workflow_id}")
async def workflow_ws(websocket: WebSocket, workflow_id: str):
    await websocket.accept()
    async def send_event(event):
        if event.workflow_id != workflow_id and workflow_id != "live":
            return
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
        if send_event in orchestrator._event_listeners:
            orchestrator._event_listeners.remove(send_event)
