import json
import pytest

from app.core.orchestrator import Orchestrator
from app.core.approval_watcher import ApprovalWatcher
from app.models.workflow import Workflow, ApprovalTracking


async def _make_waiting_workflow(session, workflow_id="wf-approval-1", approval_id="appr-1"):
    workflow = Workflow(
        id=workflow_id,
        incident_id="inc-1",
        state="WAITING_FOR_APPROVAL",
        pending_approval_id=approval_id,
        context_json=json.dumps({
            "incident_id": "inc-1",
            "requested_amount": 80000.0,
            "revenue_risk_per_day": 400000.0,
            "severity": "P0",
            "description": "test incident",
        }),
    )
    session.add(workflow)
    await session.commit()

    tracking = ApprovalTracking(workflow_id=workflow_id, approval_id=approval_id, last_known_status="PENDING")
    session.add(tracking)
    await session.commit()
    return workflow, tracking


async def test_resume_approved_workflow_transitions_to_completed(isolated_db, monkeypatch):
    orchestrator = Orchestrator()

    # Stub out all external side effects so this test is a pure state-machine check.
    async def fake_send_notification(*args, **kwargs):
        return True
    async def fake_create_issue(*args, **kwargs):
        return {"issue_number": 1, "issue_url": "https://example.com/1"}
    async def fake_think(*args, **kwargs):
        return None

    monkeypatch.setattr(orchestrator.slack, "send_notification", fake_send_notification)
    monkeypatch.setattr(orchestrator.github, "create_issue", fake_create_issue)
    monkeypatch.setattr(orchestrator.operations, "think", fake_think)

    async with isolated_db() as session:
        await _make_waiting_workflow(session)

    result = await orchestrator.resume_approved_workflow("wf-approval-1")

    assert result["status"] == "COMPLETED"
    assert result["github_issue"] == {"issue_number": 1, "issue_url": "https://example.com/1"}


async def test_resume_rejected_workflow_transitions_to_completed(isolated_db, monkeypatch):
    orchestrator = Orchestrator()

    async def fake_send_notification(*args, **kwargs):
        return True
    monkeypatch.setattr(orchestrator.slack, "send_notification", fake_send_notification)

    async with isolated_db() as session:
        await _make_waiting_workflow(session, workflow_id="wf-approval-2", approval_id="appr-2")

    result = await orchestrator.resume_rejected_workflow("wf-approval-2")
    assert result["status"] == "REJECTED"


async def test_resume_workflow_not_waiting_returns_error(isolated_db):
    orchestrator = Orchestrator()
    async with isolated_db() as session:
        workflow = Workflow(id="wf-not-waiting", incident_id="inc-x", state="CREATED")
        session.add(workflow)
        await session.commit()

    result = await orchestrator.resume_approved_workflow("wf-not-waiting")
    assert "error" in result


async def test_approval_watcher_processes_each_approval_only_once(isolated_db, monkeypatch):
    """Guards against duplicate GitHub issues / Slack pings if the poller sees the same
    APPROVED status across two poll cycles before `processed` is committed."""
    orchestrator = Orchestrator()
    watcher = ApprovalWatcher(orchestrator, interval=999)

    resume_calls = {"count": 0}

    async def fake_resume_approved(workflow_id):
        resume_calls["count"] += 1
        return {"workflow_id": workflow_id, "status": "COMPLETED"}

    monkeypatch.setattr(orchestrator, "resume_approved_workflow", fake_resume_approved)

    async def fake_get_approval_status(approval_id):
        return "APPROVED"

    monkeypatch.setattr(watcher.notion, "get_approval_status", fake_get_approval_status)

    async with isolated_db() as session:
        await _make_waiting_workflow(session, workflow_id="wf-watch-1", approval_id="appr-watch-1")

    # First poll: PENDING -> APPROVED, should resume and mark processed.
    await watcher._check_approvals()
    # Second poll: tracking.processed is now True, so it must be excluded from the query
    # and resume_approved_workflow must not be called again.
    await watcher._check_approvals()

    assert resume_calls["count"] == 1, "approval watcher must not process the same approval twice"
