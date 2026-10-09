"""Settings persistence backed by the SQLite ``settings`` table."""

from __future__ import annotations

from ..config import MAX_REMINDER_OFFSETS
from ..config import default_deadline_reminders_enabled as _env_deadline_enabled
from ..config import default_overdue_alerts_enabled as _env_overdue_alerts_enabled
from ..config import get_default_reminder_offsets as _env_offsets
from ..config import get_reminder_interval_minutes as _env_interval
from ..database import get_connection

KEY_REMINDER_INTERVAL_MINUTES = "reminder_interval_minutes"
KEY_REMINDER_OFFSETS_MINUTES = "reminder_offsets_minutes"
KEY_DEADLINE_REMINDERS_ENABLED = "deadline_reminders_enabled"
KEY_OVERDUE_ALERTS_ENABLED = "overdue_alerts_enabled"


def _serialize_offsets(values: list[int]) -> str:
    return ",".join(str(v) for v in values)


def _parse_offsets(raw: str) -> list[int]:
    values: set[int] = set()
    for token in (raw or "").replace(";", ",").split(","):
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


def _clean_offsets(values: list[int]) -> list[int]:
    cleaned = sorted({max(1, int(v)) for v in values}, reverse=True)
    return cleaned[:MAX_REMINDER_OFFSETS]


def get_reminder_interval_minutes() -> int:
    """Return the persisted reminder interval in minutes.

    Falls back to the env/file default when nothing is stored yet, and seeds
    the table so the interval is recoverable across restarts.
    """
    with get_connection() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?",
            (KEY_REMINDER_INTERVAL_MINUTES,),
        ).fetchone()
        if row is None:
            default = _env_interval()
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (KEY_REMINDER_INTERVAL_MINUTES, str(default)),
            )
            return default
        try:
            return max(1, int(row["value"]))
        except (TypeError, ValueError):
            return _env_interval()


def set_reminder_interval_minutes(value: int) -> int:
    """Persist the reminder interval. Validated: minimum of 1 minute."""
    validated = max(1, int(value))
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (KEY_REMINDER_INTERVAL_MINUTES, str(validated)),
        )
    return validated


def get_reminder_offsets() -> list[int]:
    """Pre-deadline reminder offsets in minutes (largest first).

    Falls back to the env/config default when nothing is stored, and seeds the
    table so the value is recoverable across restarts.
    """
    with get_connection() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?",
            (KEY_REMINDER_OFFSETS_MINUTES,),
        ).fetchone()
        if row is None:
            default = _env_offsets()
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (KEY_REMINDER_OFFSETS_MINUTES, _serialize_offsets(default)),
            )
            return default
        parsed = _parse_offsets(row["value"])
        return parsed if parsed else _env_offsets()


def set_reminder_offsets(values: list[int]) -> list[int]:
    """Persist pre-deadline reminder offsets. Each is clamped to >= 1 minute."""
    cleaned = _clean_offsets(values)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (KEY_REMINDER_OFFSETS_MINUTES, _serialize_offsets(cleaned)),
        )
    return cleaned


def deadline_reminders_enabled() -> bool:
    """Whether pre-deadline reminders are enabled (persisted setting)."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?",
            (KEY_DEADLINE_REMINDERS_ENABLED,),
        ).fetchone()
        if row is None:
            default = _env_deadline_enabled()
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (KEY_DEADLINE_REMINDERS_ENABLED, "1" if default else "0"),
            )
            return default
        return str(row["value"]).strip().lower() not in {"0", "false", "no"}


def set_deadline_reminders_enabled(value: bool) -> bool:
    enabled = bool(value)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (KEY_DEADLINE_REMINDERS_ENABLED, "1" if enabled else "0"),
        )
    return enabled


def overdue_alerts_enabled() -> bool:
    """Whether overdue alerts are enabled (persisted setting)."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?",
            (KEY_OVERDUE_ALERTS_ENABLED,),
        ).fetchone()
        if row is None:
            default = _env_overdue_alerts_enabled()
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (KEY_OVERDUE_ALERTS_ENABLED, "1" if default else "0"),
            )
            return default
        return str(row["value"]).strip().lower() not in {"0", "false", "no"}


def set_overdue_alerts_enabled(value: bool) -> bool:
    enabled = bool(value)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (KEY_OVERDUE_ALERTS_ENABLED, "1" if enabled else "0"),
        )
    return enabled