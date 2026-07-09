import asyncio
import logging
from sqlalchemy import select
from app.models.database import async_session
from app.models.workflow import ApprovalTracking, Workflow
from app.adapters.notion import NotionAdapter

logger = logging.getLogger(__name__)


class ApprovalWatcher:
    def __init__(self, orchestrator, interval: int = 5):
        self.orchestrator = orchestrator
        self.interval = interval
        self.notion = NotionAdapter()
        self._running = False

    async def start(self):
        self._running = True
        asyncio.create_task(self._poll_loop())

    async def stop(self):
        self._running = False

    async def _poll_loop(self):
        while self._running:
            try:
                await self._check_approvals()
            except Exception as e:
                logger.error(f"Approval watcher error: {e}")
            await asyncio.sleep(self.interval)

    async def _check_approvals(self):
        async with async_session() as session:
            result = await session.execute(
                select(ApprovalTracking).where(
                    ApprovalTracking.processed == False,
                    ApprovalTracking.last_known_status == "PENDING",
                )
            )
            pending = result.scalars().all()

            for tracking in pending:
                status = await self.notion.get_approval_status(tracking.approval_id)
                if status and status != tracking.last_known_status:
                    tracking.last_known_status = status
                    session.add(tracking)
                    await session.commit()

                    if status == "APPROVED":
                        await self.orchestrator.resume_approved_workflow(tracking.workflow_id)
                        tracking.processed = True
                        session.add(tracking)
                        await session.commit()
                    elif status == "REJECTED":
                        await self.orchestrator.resume_rejected_workflow(tracking.workflow_id)
                        tracking.processed = True
                        session.add(tracking)
                        await session.commit()
