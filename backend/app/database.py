"""SQLite database access layer.

All statements use parameterized queries. A single connection per operation is
opened via :func:`get_connection`, committed on success and rolled back on error.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import get_db_path

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT    NOT NULL,
    description      TEXT    NOT NULL DEFAULT '',
    due_date         TEXT    NOT NULL,             -- ISO date: YYYY-MM-DD
    due_time         TEXT,                         -- HH:MM:SS or NULL
    scheduled_date   TEXT,                         -- ISO date: YYYY-MM-DD (for daily planner)
    priority         TEXT    NOT NULL DEFAULT 'medium',  -- low | medium | high
    completed        INTEGER NOT NULL DEFAULT 0,
    deleted          INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT    NOT NULL,             -- UTC ISO-8601
    updated_at       TEXT    NOT NULL,             -- UTC ISO-8601
    last_notified_at TEXT                          -- UTC ISO-8601 or NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_due
    ON tasks (due_date, due_time);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled
    ON tasks (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_state
    ON tasks (deleted, completed);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Per-task, per-stage delivery markers for the deadline/overdue reminders.
-- The composite primary key makes delivery idempotent: as long as the process
-- can see this row, a stage can never be delivered twice, even across restarts.
CREATE TABLE IF NOT EXISTS notification_log (
    task_id     INTEGER NOT NULL,
    stage       TEXT    NOT NULL,   -- e.g. "pre:30", "pre:5", "overdue"
    notified_at TEXT    NOT NULL,   -- UTC ISO-8601
    PRIMARY KEY (task_id, stage)
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Yield a connection; commit on success, roll back on error."""
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables and indexes if they do not already exist."""
    with get_connection() as conn:
        conn.executescript(SCHEMA)
