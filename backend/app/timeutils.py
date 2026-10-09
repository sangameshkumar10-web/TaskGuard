"""Consistent time handling for TaskGuard.

Conventions
-----------
* ``created_at`` / ``updated_at`` / ``last_notified_at`` are stored as
  timezone-aware UTC ISO-8601 strings.
* ``due_date`` and ``due_time`` represent wall-clock local time entered by the
  user. Overdue comparisons therefore use the machine's local "now".

Keeping these two clearly separated avoids ambiguous timezone comparisons.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone

# When a task has no explicit time, treat the end of its due day as the deadline.
END_OF_DAY = time(23, 59, 59)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def local_now() -> datetime:
    """Naive local wall-clock time used for deadline comparisons."""
    return datetime.now()


def task_deadline(due_date: date, due_time: time | None) -> datetime:
    """Combine a due date and optional time into a naive local deadline.

    A missing ``due_time`` means the end of the due day (``END_OF_DAY``), so a
    task always has a well-defined deadline even when the user only picked a
    date.
    """
    return datetime.combine(due_date, due_time or END_OF_DAY)


def to_utc(value: datetime) -> datetime:
    """Normalize a datetime to a timezone-aware UTC instant.

    Naive datetimes are interpreted as local wall-clock time (matching how
    deadlines are entered), then converted. Aware datetimes are just converted.
    """
    if value.tzinfo is None:
        return value.astimezone(timezone.utc)
    return value.astimezone(timezone.utc)


def deadline_utc(due_date: date, due_time: time | None) -> datetime:
    """Absolute UTC instant for a task's local wall-clock deadline.

    This is the single value the API exposes as ``deadline_at`` so the frontend
    can compute a live countdown from an exact instant rather than re-deriving
    local time itself.
    """
    return to_utc(task_deadline(due_date, due_time))


def deadline_utc_iso(due_date: date, due_time: time | None) -> str:
    return deadline_utc(due_date, due_time).isoformat()


def is_deadline_passed(deadline: datetime, now: datetime) -> bool:
    """True once ``now`` reaches ``deadline``.

    The comparison is inclusive so the boundary is unambiguous: at exactly the
    deadline instant the task counts as due/overdue. ``deadline`` and ``now``
    must already share the same frame (both naive local, or both aware UTC).
    """
    return deadline <= now
