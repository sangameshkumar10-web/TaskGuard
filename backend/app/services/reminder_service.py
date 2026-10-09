"""Overdue reminder engine and background scheduler.

Responsibilities
--------------
* Detect overdue, incomplete, non-deleted tasks (restart recovery included —
  every poll recomputes from the database, and the very first poll runs at
  startup inside the FastAPI lifespan).
* Respect a configurable minimum interval so a task is not re-notified
  constantly: only notify when ``now - last_notified_at >= interval``.
* Persist ``last_notified_at`` so the state survives application restarts.
* Never let a failing notifier crash the scheduler loop.
* Never notify completed or soft-deleted tasks.
* Pre-deadline reminders: configurable offsets (e.g. 30 and 5 minutes before)
  fire exactly once per task per offset, persisted via ``notification_log``.

Timezone notes
--------------
``last_notified_at`` is timezone-aware UTC ISO-8601; ``now`` is also UTC-aware.
Deadline comparisons reuse ``task_service`` (naive local wall-clock) unchanged.
Pre-deadline stages compare UTC-aware ``deadline_at`` from the task with the
UTC-aware ``now`` for exact, timezone-safe boundaries.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from .. import config
from ..models import TaskStatus
from ..services import notification_service, settings_service, task_service
from ..services.notifier import TaskNotifier, get_default_notifier
from ..timeutils import to_utc

logger = logging.getLogger(__name__)

OVERDUE_STAGE = "overdue"
PRE_STAGE_PREFIX = "pre:"


def _deadline_utc(task: dict) -> Optional[datetime]:
    """Parse the task's ``deadline_at`` into a UTC-aware datetime, or None."""
    raw = task.get("deadline_at")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _pre_deadline_stages(task: dict, now: datetime, offsets: list[int]) -> list[int]:
    """Return the minute offsets whose reminder window is currently open.

    A reminder fires when ``trigger <= now < deadline`` where
    ``trigger = deadline - offset minutes``. Offsets are evaluated largest
    first (furthest reminder first), and each fires at most once per task
    thanks to the persisted delivery marker.
    """
    deadline = _deadline_utc(task)
    if deadline is None or now >= deadline:
        return []
    due: list[int] = []
    for offset in offsets:
        trigger = deadline - timedelta(minutes=offset)
        if trigger <= now < deadline:
            due.append(offset)
    return due


def _should_notify(task: dict, interval_minutes: int, now: datetime) -> bool:
    """True when the task may be notified at ``now``.

    A task with no recorded notification is always eligible; otherwise the
    elapsed time since the last notification must reach the interval.
    """
    last = task.get("last_notified_at")
    if not last:
        return True
    try:
        last_dt = datetime.fromisoformat(last)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        # Unparseable timestamp: treat as never-notified rather than silent.
        return True
    return (now - last_dt) >= timedelta(minutes=interval_minutes)


def check_and_notify(
    *,
    notifier: Optional[TaskNotifier] = None,
    interval_minutes: Optional[int] = None,
    now: Optional[datetime] = None,
    offsets_minutes: Optional[list[int]] = None,
) -> list[dict]:
    """One reminder sweep: notify eligible overdue tasks and pre-deadline stages.

    Returns the list of tasks that were actually notified.
    The interval falls back to the persisted settings value when omitted.
    Pre-deadline offsets fall back to the persisted settings value when omitted.
    """
    notifier = notifier or get_default_notifier()
    now = now or datetime.now(timezone.utc)
    interval = (
        interval_minutes
        if interval_minutes is not None
        else settings_service.get_reminder_interval_minutes()
    )

    due_tasks = task_service.list_tasks(status=TaskStatus.overdue)

    notified: list[dict] = []
    # 1) Recurring overdue reminders (existing behavior preserved).
    if settings_service.overdue_alerts_enabled():
        for task in due_tasks:
            if not _should_notify(task, interval, now):
                continue
            notifier.notify_overdue(task)
            task_service.mark_notified(task["id"], now)
            notification_service.record_delivery(task["id"], OVERDUE_STAGE, now)
            notified.append(task)

    # 2) One-shot pre-deadline reminders.
    if settings_service.deadline_reminders_enabled():
        offsets = (
            offsets_minutes
            if offsets_minutes is not None
            else settings_service.get_reminder_offsets()
        )
        for task in task_service.list_tasks(status=TaskStatus.pending):
            for offset in _pre_deadline_stages(task, now, offsets):
                stage = f"{PRE_STAGE_PREFIX}{offset}"
                if notification_service.was_delivered(task["id"], stage):
                    continue
                notifier.notify_upcoming(task, offset)
                notification_service.record_delivery(task["id"], stage, now)
                notified.append(task)
    return notified


class ReminderScheduler:
    """Async background loop that runs reminder sweeps.

    Safe to start more than once: duplicate start calls are ignored so two
    scheduler instances can never poll the same process simultaneously.
    """

    def __init__(
        self,
        *,
        poll_seconds: Optional[float] = None,
        enabled: Optional[bool] = None,
        poll_handler: Optional[Callable[[], None]] = None,
        notifier: Optional[TaskNotifier] = None,
    ) -> None:
        self.poll_seconds = (
            poll_seconds
            if poll_seconds is not None
            else config.get_reminder_poll_seconds()
        )
        self.enabled = config.reminder_enabled() if enabled is None else enabled
        self._handler = poll_handler or (lambda: check_and_notify(notifier=notifier))
        self._task: Optional[asyncio.Task] = None

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self) -> None:
        """Begin polling. No-op if disabled or already running."""
        if not self.enabled or self.running:
            return
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        """Cancel the polling loop. Safe to call multiple times."""
        task, self._task = self._task, None
        if task is None:
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    async def _run(self) -> None:
        while True:
            await self._step()
            await asyncio.sleep(self.poll_seconds)

    async def _step(self) -> None:
        try:
            await asyncio.to_thread(self._handler)
        except Exception:  # noqa: BLE001 - keep the loop alive
            logger.exception("reminder sweep failed")