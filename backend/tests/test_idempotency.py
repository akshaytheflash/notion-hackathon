import pytest

from app.core.orchestrator import Orchestrator
from app.models.workflow import IntegrationAction


async def test_idempotent_action_runs_once(isolated_db):
    orchestrator = Orchestrator()
    calls = {"count": 0}

    async def side_effect():
        calls["count"] += 1
        return {"issue_number": 42, "issue_url": "https://github.com/x/y/issues/42"}

    async with isolated_db() as session:
        result1 = await orchestrator._run_idempotent_action(
            session, "wf-1", "github_create_issue", "github:create_issue:wf-1", side_effect
        )
        result2 = await orchestrator._run_idempotent_action(
            session, "wf-1", "github_create_issue", "github:create_issue:wf-1", side_effect
        )

    assert calls["count"] == 1, "side effect should only run once for the same idempotency key"
    assert result1 == result2 == {"issue_number": 42, "issue_url": "https://github.com/x/y/issues/42"}


async def test_idempotent_action_records_failure_and_allows_retry(isolated_db):
    orchestrator = Orchestrator()
    calls = {"count": 0}

    async def flaky_then_ok():
        calls["count"] += 1
        if calls["count"] == 1:
            return None  # simulates adapter returning None on failure
        return {"ok": True}

    async with isolated_db() as session:
        first = await orchestrator._run_idempotent_action(
            session, "wf-2", "github_create_issue", "github:create_issue:wf-2", flaky_then_ok
        )
        assert first is None

        from sqlalchemy import select
        row = (await session.execute(
            select(IntegrationAction).where(IntegrationAction.idempotency_key == "github:create_issue:wf-2")
        )).scalar_one()
        assert row.status == "FAILED"

        second = await orchestrator._run_idempotent_action(
            session, "wf-2", "github_create_issue", "github:create_issue:wf-2", flaky_then_ok
        )

    assert calls["count"] == 2, "a FAILED action should be retried, not treated as a cache hit"
    assert second == {"ok": True}


async def test_idempotent_action_captures_exceptions(isolated_db):
    orchestrator = Orchestrator()

    async def boom():
        raise RuntimeError("network exploded")

    async with isolated_db() as session:
        result = await orchestrator._run_idempotent_action(
            session, "wf-3", "github_create_issue", "github:create_issue:wf-3", boom
        )

        from sqlalchemy import select
        row = (await session.execute(
            select(IntegrationAction).where(IntegrationAction.idempotency_key == "github:create_issue:wf-3")
        )).scalar_one()
        assert row.status == "FAILED"
        assert "network exploded" in row.error

    assert result is None
