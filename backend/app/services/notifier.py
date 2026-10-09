"""Notifier abstraction for overdue-task alerts.

The reminder engine depends only on :class:`TaskNotifier`, so the concrete
delivery mechanism (Windows toast via Electron, system tray balloon, log file,
etc.) can be swapped without touching reminder logic.

The default notifier is chosen at call time from the environment:

* ``TASKGUARD_NOTIFIER`` = noop/none/log-none/0  -> :class:`NoopNotifier`
* ``TASKGUARD_NOTIFY_URL`` set                    -> :class:`BroadcastNotifier`
  (the Electron desktop shell sets this when it spawns the backend, so every
  scheduled reminder is delivered as a real Windows notification).
* otherwise                                       -> :class:`LogNotifier`
"""

from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


class TaskNotifier(ABC):
    """Sends a user-facing alert for an overdue task."""

    @abstractmethod
    def notify_overdue(self, task: dict) -> None:
        """Deliver the alert. Raises on failure so the caller can decide."""

    def notify_upcoming(self, task: dict, minutes_before: int) -> None:
        """Deliver a pre-deadline alert.

        Default implementation does nothing. Subclasses that support
        pre-deadline reminders should override this.
        """
        return

    def close(self) -> None:
        """Release any resources. Override if the backend needs cleanup."""


class LogNotifier(TaskNotifier):
    """Writes the overdue alert to the application log.

    Fallback when no desktop notification channel is configured.
    """

    def notify_overdue(self, task: dict) -> None:
        logger.info("OVERDUE task #%s: %s", task["id"], task["title"])

    def notify_upcoming(self, task: dict, minutes_before: int) -> None:
        logger.info(
            "UPCOMING (%d min) task #%s: %s", minutes_before, task["id"], task["title"]
        )


class NoopNotifier(TaskNotifier):
    """Does nothing; useful where notifications are not desired."""

    def notify_overdue(self, task: dict) -> None:
        pass


class BroadcastNotifier(TaskNotifier):
    """Posts overdue alerts to the desktop shell over loopback HTTP.

    The Electron shell starts a local listener and passes its URL to the
    backend via ``TASKGUARD_NOTIFY_URL``; the backend remains the single
    reminder scheduler (no second reminder loop runs inside Electron).
    Delivery failures are logged but never raised, so they cannot abort the
    reminder sweep or lose ``last_notified_at`` state.
    """

    def __init__(self, url: Optional[str] = None) -> None:
        self.url = (url or os.environ.get("TASKGUARD_NOTIFY_URL") or "").strip()
        self.timeout = int(os.environ.get("TASKGUARD_NOTIFY_TIMEOUT", "2"))

    def notify_overdue(self, task: dict) -> None:
        if not self.url:
            return
        payload = {
            "id": task["id"],
            "title": task["title"],
            "due_date": task.get("due_date"),
            "due_time": task.get("due_time"),
            "kind": "overdue",
        }
        request = Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                if response.status >= 400:  # pragma: no cover - server returns 2xx
                    logger.error(
                        "notification broadcast returned %s", response.status
                    )
        except Exception:  # noqa: BLE001 - never break the reminder sweep
            logger.exception("failed to broadcast notification for task #%s", task["id"])

    def notify_upcoming(self, task: dict, minutes_before: int) -> None:
        if not self.url:
            return
        payload = {
            "id": task["id"],
            "title": task["title"],
            "due_date": task.get("due_date"),
            "due_time": task.get("due_time"),
            "kind": "pre",
            "minutes_before": minutes_before,
        }
        request = Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                if response.status >= 400:
                    logger.error(
                        "upcoming notification broadcast returned %s", response.status
                    )
        except Exception:
            logger.exception(
                "failed to broadcast upcoming notification for task #%s", task["id"]
            )


class CollectingNotifier(TaskNotifier):
    """Records every notified task for assertions (test helper)."""

    def __init__(self) -> None:
        self.notified: list[dict] = []
        self.upcoming: list[tuple[dict, int]] = []

    def notify_overdue(self, task: dict) -> None:
        self.notified.append(dict(task))

    def notify_upcoming(self, task: dict, minutes_before: int) -> None:
        self.upcoming.append((dict(task), minutes_before))


def get_default_notifier() -> TaskNotifier:
    """Return the process-wide default notifier.

    Override via TASKGUARD_NOTIFIER env in tests to prevent side-effects:
    '' or 'noop' -> NoopNotifier, otherwise the standard LogNotifier.
    """
    override = os.environ.get("TASKGUARD_NOTIFIER", "").strip().lower()
    if override in {"noop", "none", "log-none", "0"}:
        return NoopNotifier()

    notify_url = os.environ.get("TASKGUARD_NOTIFY_URL", "").strip()
    if notify_url:
        return BroadcastNotifier(notify_url)

    return LogNotifier()