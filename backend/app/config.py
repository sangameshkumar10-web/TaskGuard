"""Application configuration and path resolution.

All values are resolved at call time so that tests can override them via
environment variables without reloading modules.
"""

from __future__ import annotations

import os
from pathlib import Path

# backend/app/config.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent
# E:\TaskGuard
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"

# Network: bind to loopback only. Never expose the API on the public network.
API_HOST = os.environ.get("TASKGUARD_API_HOST", "127.0.0.1")
API_PORT = int(os.environ.get("TASKGUARD_API_PORT", "8000"))

DEFAULT_REMINDER_INTERVAL_MINUTES = 15
DEFAULT_REMINDER_POLL_SECONDS = 30
MIN_REMINDER_INTERVAL_MINUTES = 1

# Deadline reminders fire once per configured offset *before* the deadline
# (e.g. 30 and 5 minutes before), plus the recurring overdue alert handled by
# the reminder interval above. These are only defaults: the effective values
# live in the persisted settings table and are editable from the UI.
DEFAULT_REMINDER_OFFSETS_MINUTES = (30, 5)
MAX_REMINDER_OFFSETS = 10

# Overdue alerts (recurring) are enabled by default. Can be toggled in settings.
DEFAULT_OVERDUE_ALERTS_ENABLED = True


def get_db_path() -> Path:
    """Return the SQLite database path, honoring an env override (used by tests)."""
    override = os.environ.get("TASKGUARD_DB_PATH")
    if override:
        return Path(override)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR / "taskguard.db"


def get_reminder_interval_minutes() -> int:
    """Reminder interval in minutes; minimum of 1 to avoid notification spam."""
    raw = os.environ.get(
        "TASKGUARD_REMINDER_INTERVAL_MINUTES",
        str(DEFAULT_REMINDER_INTERVAL_MINUTES),
    )
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_REMINDER_INTERVAL_MINUTES
    return max(MIN_REMINDER_INTERVAL_MINUTES, value)


def get_reminder_poll_seconds() -> float:
    """How often the background loop rechecks overdue tasks (seconds)."""
    raw = os.environ.get("TASKGUARD_REMINDER_POLL_SECONDS", str(DEFAULT_REMINDER_POLL_SECONDS))
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return DEFAULT_REMINDER_POLL_SECONDS
    return max(1.0, value)


def reminder_enabled() -> bool:
    """Master switch for the background reminder scheduler.

    Set TASKGUARD_REMINDER_ENABLED=0 to disable (used by tests for determinism).
    """
    raw = os.environ.get("TASKGUARD_REMINDER_ENABLED", "1")
    return raw.strip().lower() not in {"0", "false", "no"}


def _parse_offsets(raw: str) -> list[int]:
    """Parse a comma/space separated list of positive minute offsets."""
    values: set[int] = set()
    for token in raw.replace(";", ",").split(","):
        token = token.strip()
        if not token:
            continue
        try:
            minutes = int(token)
        except (TypeError, ValueError):
            continue
        if minutes >= 1:
            values.add(minutes)
    return sorted(values, reverse=True)[:MAX_REMINDER_OFFSETS]


def get_default_reminder_offsets() -> list[int]:
    """Fallback pre-deadline reminder offsets (minutes before the deadline).

    Override with TASKGUARD_REMINDER_OFFSETS_MINUTES="60,30,5" if desired.
    """
    raw = os.environ.get(
        "TASKGUARD_REMINDER_OFFSETS_MINUTES",
        ",".join(str(v) for v in DEFAULT_REMINDER_OFFSETS_MINUTES),
    )
    parsed = _parse_offsets(raw)
    return parsed or list(DEFAULT_REMINDER_OFFSETS_MINUTES)


def default_deadline_reminders_enabled() -> bool:
    """Whether pre-deadline reminders are on by default.

    TASKGUARD_DEADLINE_REMINDERS_ENABLED=0 disables them.
    """
    raw = os.environ.get("TASKGUARD_DEADLINE_REMINDERS_ENABLED", "1")
    return raw.strip().lower() not in {"0", "false", "no"}


def default_overdue_alerts_enabled() -> bool:
    """Whether overdue alerts are on by default.

    TASKGUARD_OVERDUE_ALERTS_ENABLED=0 disables them.
    """
    raw = os.environ.get("TASKGUARD_OVERDUE_ALERTS_ENABLED", "1")
    return raw.strip().lower() not in {"0", "false", "no"}
