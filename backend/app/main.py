import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.models.database import init_db
from app.routes.api import router, orchestrator
from app.core.approval_watcher import ApprovalWatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

approval_watcher: ApprovalWatcher | None = None

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
logger.info(f"Frontend dir: {FRONTEND_DIR} (exists: {FRONTEND_DIR.exists()})")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global approval_watcher
    logger.info("Starting Enterprise AI OS backend...")
    await init_db()
    logger.info("Database initialized")
    approval_watcher = ApprovalWatcher(orchestrator, settings.approval_poll_interval_seconds)
    await approval_watcher.start()
    logger.info(f"Approval watcher started (interval: {settings.approval_poll_interval_seconds}s)")
    yield
    if approval_watcher:
        await approval_watcher.stop()
    logger.info("Shutdown complete")


app = FastAPI(title="Enterprise AI OS", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/")
    async def fallback():
        return JSONResponse({"error": "Frontend not built. Run: cd frontend && npm install && npm run build"})
