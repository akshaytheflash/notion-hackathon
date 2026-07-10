import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.models.database as db_module
from app.models.database import Base


@pytest_asyncio.fixture
async def isolated_db(monkeypatch):
    """Point app.models.database at a fresh in-memory sqlite DB for the test.

    Uses a shared in-memory sqlite (via StaticPool-like URI) so every
    connection in the test sees the same tables, and patches the module-level
    `engine` / `async_session` that orchestrator.py, approval_watcher.py etc.
    all import at call time (they do `from app.models.database import
    async_session`, so we patch the attribute on the module object itself
    rather than re-importing, and re-patch the references those modules hold).
    """
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true",
        connect_args={"uri": True},
    )
    test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Patch the shared references used across the codebase.
    monkeypatch.setattr(db_module, "engine", test_engine, raising=False)
    monkeypatch.setattr(db_module, "async_session", test_session, raising=False)
    import app.core.orchestrator as orch_module
    import app.core.approval_watcher as watcher_module
    monkeypatch.setattr(orch_module, "async_session", test_session, raising=False)
    monkeypatch.setattr(watcher_module, "async_session", test_session, raising=False)

    yield test_session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
