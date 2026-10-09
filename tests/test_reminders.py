"""Automated tests for the overdue reminder engine.

The engine is tested directly (``check_and_notify`` with an explicit UTC ``now``
and a collecting notifier) rather than through the HTTP layer, so the tests are
deterministic and independent of the background scheduler timing.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import pytest

from app.services.notifier import CollectingNotifier
from app.services.reminder_service import ReminderScheduler, check_and_notify


def _overdue_payload(title="Overdue task"):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    return {"title": title, "due_date": yesterday}


def _now():
    return datetime.now(timezone.utc)


def _ids(tasks):
    return {t["id"] for t in tasks}


class CollectingBoomNotifier(CollectingNotifier):
    """Notifier that always raises, used to prove failed deliveries retry."""

    def notify_overdue(self, task: dict) -> None:
        raise RuntimeError("delivery failed")


class TestOverdueDetection:
    def test_overdue_task_is_notified(self, client, make_task):
        task = make_task(_overdue_payload())
        cap = CollectingNotifier()
        notified = check_and_notify(notifier=cap, now=_now(), interval_minutes=15)
        assert _ids(notified) == {task["id"]}
        assert _ids(cap.notified) == {task["id"]}

    def test_future_task_is_not_notified(self, client, make_task):
        make_task({"title": "Later", "due_date": "2099-01-01"})
        cap = CollectingNotifier()
        assert check_and_notify(notifier=cap, now=_now()) == []
        assert cap.notified == []

    def test_today_with_past_time_is_overdue(self, client, make_task):
        task = make_task(
            {"title": "Due earlier", "due_date": date.today().isoformat(), "due_time": "00:00:00"}
        )
        cap = CollectingNotifier()
        notified = check_and_notify(notifier=cap, now=_now())
        assert _ids(notified) == {task["id"]}

    def test_completed_task_is_never_notified(self, client, make_task):
        task = make_task(_overdue_payload())
        client.patch(f"/api/tasks/{task['id']}", json={"completed": True})
        cap = CollectingNotifier()
        assert check_and_notify(notifier=cap, now=_now()) == []
        assert cap.notified == []

    def test_deleted_task_is_never_notified(self, client, make_task):
        task = make_task(_overdue_payload())
        client.delete(f"/api/tasks/{task['id']}")
        cap = CollectingNotifier()
        assert check_and_notify(notifier=cap, now=_now()) == []
        assert cap.notified == []

    def test_only_live_overdue_tasks_are_notified(self, client, make_task):
        live = make_task(_overdue_payload("live"))
        done = make_task(_overdue_payload("done"))
        gone = make_task(_overdue_payload("gone"))
        future = make_task({"title": "later", "due_date": "2099-01-01"})
        client.patch(f"/api/tasks/{done['id']}", json={"completed": True})
        client.delete(f"/api/tasks/{gone['id']}")

        cap = CollectingNotifier()
        notified = check_and_notify(notifier=cap, now=_now())
        assert _ids(notified) == {live["id"]}
        assert future["id"] not in _ids(cap.notified)


class TestNotificationDeduplication:
    def test_last_notified_at_is_persisted(self, client, make_task):
        task = make_task(_overdue_payload())
        base = _now()
        check_and_notify(notifier=CollectingNotifier(), now=base, interval_minutes=15)
        body = client.get(f"/api/tasks/{task['id']}").json()
        assert body["last_notified_at"] is not None
        stored = datetime.fromisoformat(body["last_notified_at"])
        assert stored.tzinfo is not None
        assert abs((stored - base).total_seconds()) < 5

    def test_no_duplicate_within_interval(self, client, make_task):
        task = make_task(_overdue_payload())
        base = _now()
        cap = CollectingNotifier()
        first = check_and_notify(notifier=cap, now=base, interval_minutes=15)
        assert _ids(first) == {task["id"]}

        later = check_and_notify(notifier=cap, now=base + timedelta(minutes=5), interval_minutes=15)
        assert later == []
        assert len(cap.notified) == 1

    def test_notified_again_after_interval_elapses(self, client, make_task):
        task = make_task(_overdue_payload())
        base = _now()
        cap = CollectingNotifier()
        check_and_notify(notifier=cap, now=base, interval_minutes=15)
        again = check_and_notify(notifier=cap, now=base + timedelta(minutes=16), interval_minutes=15)
        assert _ids(again) == {task["id"]}
        assert len(cap.notified) == 2

    def test_failing_notifier_does_not_store_last_notified(self, client, make_task):
        task = make_task(_overdue_payload())
        with pytest.raises(RuntimeError):
            check_and_notify(notifier=CollectingBoomNotifier(), now=_now(), interval_minutes=15)
        body = client.get(f"/api/tasks/{task['id']}").json()
        assert body["last_notified_at"] is None

    def test_completed_between_cycles_not_notified_twice(self, client, make_task):
        task = make_task(_overdue_payload())
        cap = CollectingNotifier()
        base = _now()
        check_and_notify(notifier=cap, now=base, interval_minutes=15)

        client.patch(f"/api/tasks/{task['id']}", json={"completed": True})
        later = check_and_notify(notifier=cap, now=base + timedelta(minutes=60), interval_minutes=15)
        assert later == []
        assert len(cap.notified) == 1


class TestIntervalConfiguration:
    def test_settings_endpoint_reads_and_writes(self, client):
        assert client.get("/api/settings/reminder-interval").json() == {"value": 15}
        response = client.put("/api/settings/reminder-interval", json={"value": 45})
        assert response.status_code == 200
        assert client.get("/api/settings/reminder-interval").json() == {"value": 45}

    def test_interval_below_one_is_rejected(self, client):
        response = client.put("/api/settings/reminder-interval", json={"value": 0})
        assert response.status_code == 422

    def test_interval_is_read_from_settings_when_omitted(self, client, make_task):
        task = make_task(_overdue_payload())
        client.put("/api/settings/reminder-interval", json={"value": 30})

        cap = CollectingNotifier()
        base = _now()
        check_and_notify(notifier=cap, now=base)  # interval read from settings
        assert _ids(cap.notified) == {task["id"]}

        later = check_and_notify(notifier=cap, now=base + timedelta(minutes=29))
        assert later == []

        much_later = check_and_notify(notifier=cap, now=base + timedelta(minutes=31))
        assert _ids(much_later) == {task["id"]}

    def test_restart_recovery_respects_interval(self, client, make_task):
        """Simulate a shutdown/restart: state lives in SQLite, so a fresh sweep
        sees the persisted last_notified_at and does not duplicate."""
        task = make_task(_overdue_payload())
        cap = CollectingNotifier()

        # "before shutdown": first sweep notified the task
        base = _now()
        first = check_and_notify(notifier=cap, now=base, interval_minutes=15)
        assert _ids(first) == {task["id"]}

        # "after restart, 5 minutes later": no duplicate yet
        after_restart = check_and_notify(notifier=cap, now=base + timedelta(minutes=5), interval_minutes=15)
        assert after_restart == []

        # interval eventually elapses -> reminder fires again
        later = check_and_notify(notifier=cap, now=base + timedelta(minutes=16), interval_minutes=15)
        assert _ids(later) == {task["id"]}

    def test_restart_recovery_notifies_never_alerted_tasks(self, client, make_task):
        """Overdue tasks never notified before shutdown fire on first sweep."""
        task = make_task(_overdue_payload())
        cap = CollectingNotifier()
        notified = check_and_notify(notifier=cap, now=_now())
        assert _ids(notified) == {task["id"]}


class TestScheduler:
    def test_start_is_idempotent(self):
        calls = []
        schedule = []

        async def run():
            def handler():
                calls.append(len(calls) + 1)
                schedule.append(calls[-1])

            scheduler = ReminderScheduler(
                enabled=True, poll_seconds=0.02, poll_handler=handler
            )
            scheduler.start()
            first_task = scheduler._task
            scheduler.start()
            scheduler.start()
            assert scheduler._task is first_task, "duplicate scheduler instance started"
            assert scheduler.running
            await asyncio.sleep(0.1)
            assert len(calls) > 0, "scheduler never polled"
            peak = len(calls)
            await scheduler.stop()
            assert not scheduler.running
            await scheduler.stop()  # idempotent stop
            await asyncio.sleep(0.1)
            assert len(calls) <= peak + 2, "scheduler kept running after stop"

        asyncio.run(run())

    def test_disabled_scheduler_never_starts(self):
        calls = []
        scheduler = ReminderScheduler(
            enabled=False, poll_seconds=0.02, poll_handler=lambda: calls.append(1)
        )
        scheduler.start()
        assert not scheduler.running
        assert calls == []

    def test_failing_handler_does_not_stop_the_loop(self):
        async def run():
            failures = []

            def handler():
                failures.append(1)
                raise RuntimeError("boom")

            scheduler = ReminderScheduler(
                enabled=True, poll_seconds=0.02, poll_handler=handler
            )
            scheduler.start()
            await asyncio.sleep(0.1)
            await scheduler.stop()
            assert len(failures) > 0, "handler never ran"
            assert scheduler._task is None

        asyncio.run(run())