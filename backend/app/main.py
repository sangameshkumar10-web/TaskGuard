"""TaskGuard FastAPI application.

Binds to 127.0.0.1 only (see run.py / config.py) so the API is not visible on
the public network.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import config
from .database import init_db
from .routes import settings, tasks
from .services.reminder_service import ReminderScheduler

_scheduler = ReminderScheduler()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    # First sweep runs immediately (restart recovery); no duplicates because
    # the engine re-reads last_notified_at from the database each cycle.
    _scheduler.start()
    try:
        yield
    finally:
        await _scheduler.stop()


def create_app() -> FastAPI:
    application = FastAPI(title="TaskGuard API", version="0.1.0", lifespan=lifespan)
    application.include_router(tasks.router)
    application.include_router(settings.router)

    @application.get("/api/health")
    def health() -> dict:
        """Liveness probe used by the Electron shell before loading the UI."""
        return {"status": "ok"}

    # Production desktop shell: serve the built frontend from the same
    # loopback origin as the API. Registered last so API routes above always
    # win. During Vite development this mount is inert (Electron loads the dev
    # server instead) and if the frontend has not been built it is skipped.
    dist_dir = config.PROJECT_ROOT / "frontend" / "dist"
    if dist_dir.is_dir():
        application.mount(
            "/", StaticFiles(directory=str(dist_dir), html=True), name="frontend"
        )

    return application


app = create_app()