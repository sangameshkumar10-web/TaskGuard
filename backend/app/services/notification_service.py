"""Persistent delivery markers for deadline/overdue notifications.

The reminder engine must never deliver the same *stage* of the same task twice,
even if the app is restarted or the machine sleeps. Each successful delivery is
recorded in the SQLite ``notification_log`` table keyed by ``(task_id, stage)``,
which is the same storage approach the rest of the app already uses.

Stages
------
* ``pre:<minutes>`` - a one-shot reminder fired ``<minutes>`` before the
  deadline (e.g. ``pre:30``, ``pre:5``).
* ``overdue``       - the recurring overdue alert. Repeat delivery is gated by
  ``tasks.last_notified_at``; this table only keeps a history/audit row.
"""

from __future__ import annotations

from datetime import datetime

from ..database import get_connection

OVERDUE_STAGE = "overdue"
PRE_STAGE_PREFIX = "pre:"


def pre_stage(minutes_before: int) -> str:
    return f"{PRE_STAGE_PREFIX}{int(minutes_before)}"


def was_delivered(task_id: int, stage: str) -> bool:
    """True when this task/stage has already been delivered at least once."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM notification_log WHERE task_id = ? AND stage = ?",
            (task_id, stage),
        ).fetchone()
    return row is not None


def record_delivery(task_id: int, stage: str, when: datetime) -> None:
    """Idempotently record that ``stage`` was delivered for ``task_id``.

    ``notified_at`` is updated on repeat deliveries (e.g. overdue reminders) so
    the table doubles as a last-delivery history, but the row's existence is
    what makes pre-deadline stages occur exactly once.
    """
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO notification_log (task_id, stage, notified_at) "
            "VALUES (?, ?, ?) "
            "ON CONFLICT(task_id, stage) DO UPDATE SET notified_at = excluded.notified_at",
            (task_id, stage, when.isoformat()),
        )


def delivered_stages(task_id: int) -> list[str]:
    """Return the stages already delivered for a task (test/introspection)."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT stage FROM notification_log WHERE task_id = ? ORDER BY stage",
            (task_id,),
        ).fetchall()
    return [row["stage"] for row in rows]


def clear_for_task(task_id: int) -> None:
    """Forget all delivery markers for a task.

    Called when a task's deadline changes so reminders are re-armed for the new
    deadline (and, defensively, when a task is removed).
    """
    with get_connection() as conn:
        conn.execute("DELETE FROM notification_log WHERE task_id = ?", (task_id,))
