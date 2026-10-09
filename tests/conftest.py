"""Shared pytest fixtures for TaskGuard."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """FastAPI test client backed by an isolated temporary SQLite database."""
    db_path = tmp_path / "test-taskguard.db"
    monkeypatch.setenv("TASKGUARD_DB_PATH", str(db_path))
    monkeypatch.setenv("TASKGUARD_API_HOST", "127.0.0.1")
    # Deterministic reminder tests: the background poller is exercised
    # explicitly via check_and_notify / ReminderScheduler instead.
    monkeypatch.setenv("TASKGUARD_REMINDER_ENABLED", "0")

    from app.database import init_db
    from fastapi.testclient import TestClient

    from app.main import app

    init_db()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def make_task(client):
    """Factory producing a task via the API, returning its JSON payload."""

    def _make(payload=None):
        default = {
            "title": "Sample task",
            "description": "Default description",
            "due_date": "2030-12-31",
            "due_time": "17:30:00",
            "priority": "medium",
        }
        if payload:
            default.update(payload)
        response = client.post("/api/tasks", json=default)
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture()
def auth_headers(client) -> None:
    """Placeholder for future auth; kept to make client fixture self-documenting."""
    return None