"""Automated tests for task CRUD operations and validation."""

from __future__ import annotations

from datetime import date, timedelta

import pytest


def _overdue_payload():
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    return {"title": "Overdue", "due_date": yesterday}


class TestCreateTask:
    def test_creates_task_with_defaults(self, client, make_task):
        task = make_task({"title": "Write report"})
        assert task["id"] > 0
        assert task["title"] == "Write report"
        assert task["description"] == "Default description"
        assert task["due_date"] == "2030-12-31"
        assert task["due_time"] == "17:30:00"
        assert task["priority"] == "medium"
        assert task["completed"] is False
        assert task["is_overdue"] is False
        assert task["last_notified_at"] is None
        assert task["created_at"]
        assert task["updated_at"] == task["created_at"]

    def test_title_is_trimmed(self, client, make_task):
        task = make_task({"title": "  padded  "})
        assert task["title"] == "padded"

    def test_due_time_optional(self, client, make_task):
        task = make_task({"due_time": None})
        assert task["due_time"] is None

    def test_rejects_blank_title(self, client):
        payload = {"title": "   ", "due_date": "2030-12-31"}
        response = client.post("/api/tasks", json=payload)
        assert response.status_code == 422

    def test_rejects_missing_title(self, client):
        response = client.post("/api/tasks", json={"due_date": "2030-12-31"})
        assert response.status_code == 422

    def test_rejects_missing_due_date(self, client):
        response = client.post("/api/tasks", json={"title": "No date"})
        assert response.status_code == 422

    def test_rejects_invalid_priority(self, client):
        payload = {"title": "Bad prio", "due_date": "2030-12-31", "priority": "urgent"}
        response = client.post("/api/tasks", json=payload)
        assert response.status_code == 422

    def test_rejects_title_too_long(self, client):
        payload = {"title": "x" * 201, "due_date": "2030-12-31"}
        response = client.post("/api/tasks", json=payload)
        assert response.status_code == 422


class TestFlexibleDateInput:
    def test_accepts_slash_separated_date(self, client, make_task):
        task = make_task({"due_date": "2030/01/15"})
        assert task["due_date"] == "2030-01-15"

    def test_accepts_dot_separated_date(self, client, make_task):
        task = make_task({"due_date": "2030.01.15"})
        assert task["due_date"] == "2030-01-15"

    def test_accepts_compact_date(self, client, make_task):
        task = make_task({"due_date": "20300115"})
        assert task["due_date"] == "2030-01-15"

    def test_update_accepts_slash_separated_date(self, client, make_task):
        task = make_task()
        response = client.patch(
            f"/api/tasks/{task['id']}", json={"due_date": "2031/02/03"}
        )
        assert response.status_code == 200
        assert response.json()["due_date"] == "2031-02-03"

    def test_still_rejects_clearly_invalid_date(self, client):
        response = client.post(
            "/api/tasks", json={"title": "Bad", "due_date": "not-a-date"}
        )
        assert response.status_code == 422


class TestGetTask:
    def test_get_task(self, client, make_task):
        created = make_task()
        response = client.get(f"/api/tasks/{created['id']}")
        assert response.status_code == 200
        assert response.json()["id"] == created["id"]

    def test_get_missing_task_returns_404(self, client):
        response = client.get("/api/tasks/999999")
        assert response.status_code == 404


class TestUpdateTask:
    def test_update_title_and_priority(self, client, make_task):
        task = make_task()
        response = client.patch(
            f"/api/tasks/{task['id']}",
            json={"title": "Renamed", "priority": "high"},
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["title"] == "Renamed"
        assert updated["priority"] == "high"
        assert updated["updated_at"] != task["updated_at"]

    def test_partial_update_keeps_other_fields(self, client, make_task):
        task = make_task({"description": "original"})
        response = client.patch(f"/api/tasks/{task['id']}", json={"title": "Only"})
        body = response.json()
        assert body["title"] == "Only"
        assert body["description"] == "original"
        assert body["due_date"] == task["due_date"]

    def test_clear_due_time(self, client, make_task):
        task = make_task({"due_time": "09:00:00"})
        response = client.patch(f"/api/tasks/{task['id']}", json={"due_time": None})
        assert response.json()["due_time"] is None

    def test_update_missing_task_returns_404(self, client):
        response = client.patch("/api/tasks/999999", json={"title": "nope"})
        assert response.status_code == 404

    def test_update_blank_title_rejected(self, client, make_task):
        task = make_task()
        response = client.patch(f"/api/tasks/{task['id']}", json={"title": "  "})
        assert response.status_code == 422

    def test_update_with_empty_body_is_a_noop(self, client, make_task):
        task = make_task()
        response = client.patch(f"/api/tasks/{task['id']}", json={})
        assert response.status_code == 200
        assert response.json()["id"] == task["id"]


class TestCompleteTask:
    def test_complete_task(self, client, make_task):
        task = make_task()
        response = client.patch(f"/api/tasks/{task['id']}", json={"completed": True})
        body = response.json()
        assert body["completed"] is True
        assert body["is_overdue"] is False

    def test_uncomplete_task(self, client, make_task):
        task = make_task({"completed": True})
        response = client.patch(f"/api/tasks/{task['id']}", json={"completed": False})
        assert response.json()["completed"] is False


class TestDeleteTask:
    def test_delete_removes_from_listing(self, client, make_task):
        task = make_task()
        response = client.delete(f"/api/tasks/{task['id']}")
        assert response.status_code == 204
        assert client.get(f"/api/tasks/{task['id']}").status_code == 404
        assert client.get("/api/tasks").json() == []

    def test_delete_missing_task_returns_404(self, client):
        assert client.delete("/api/tasks/999999").status_code == 404

    def test_soft_delete_allows_re_create_same_id(self, client, make_task):
        # Deletion is soft; a fresh insert gets the next AUTOINCREMENT id.
        first = make_task()
        client.delete(f"/api/tasks/{first['id']}")
        second = make_task()
        assert second["id"] != first["id"]


class TestListTasks:
    def test_empty_list(self, client):
        assert client.get("/api/tasks").json() == []

    def test_search_matches_title_and_description(self, client, make_task):
        make_task({"title": "Fix the router", "description": "wifi issues"})
        make_task({"title": "Buy milk", "description": "at the store"})

        by_title = client.get("/api/tasks", params={"search": "router"})
        assert len(by_title.json()) == 1
        assert by_title.json()[0]["title"] == "Fix the router"

        by_desc = client.get("/api/tasks", params={"search": "wifi"})
        assert len(by_desc.json()) == 1

        unrelated = client.get("/api/tasks", params={"search": "zzzz"})
        assert unrelated.json() == []

    def test_filter_by_priority(self, client, make_task):
        make_task({"priority": "high"})
        make_task({"priority": "high"})
        make_task({"priority": "low"})
        response = client.get("/api/tasks", params={"priority": "high"})
        assert len(response.json()) == 2
        assert all(t["priority"] == "high" for t in response.json())

    def test_filter_by_status(self, client, make_task):
        make_task()
        completed = make_task()
        client.patch(f"/api/tasks/{completed['id']}", json={"completed": True})

        pending = client.get("/api/tasks", params={"status": "pending"})
        assert len(pending.json()) == 1
        assert pending.json()[0]["id"] != completed["id"]

        done = client.get("/api/tasks", params={"status": "completed"})
        assert len(done.json()) == 1
        assert done.json()[0]["id"] == completed["id"]

    def test_overdue_filter_excludes_completed(self, client, make_task):
        payload = _overdue_payload()
        overdue = make_task(dict(payload))
        completed_overdue = make_task(dict(payload))
        client.patch(
            f"/api/tasks/{completed_overdue['id']}", json={"completed": True}
        )

        response = client.get("/api/tasks", params={"status": "overdue"})
        body = response.json()
        ids = {t["id"] for t in body}
        assert overdue["id"] in ids
        assert completed_overdue["id"] not in ids
        assert all(t["is_overdue"] for t in body)

    def test_overdue_flag_on_single_task(self, client, make_task):
        overdue = make_task(_overdue_payload())
        future = make_task({"due_date": "2099-01-01"})
        assert client.get(f"/api/tasks/{overdue['id']}").json()["is_overdue"] is True
        assert client.get(f"/api/tasks/{future['id']}").json()["is_overdue"] is False

    def test_sort_by_due_date(self, client, make_task):
        make_task({"title": "later", "due_date": "2035-01-01"})
        make_task({"title": "sooner", "due_date": "2030-01-01"})
        asc = client.get("/api/tasks", params={"sort": "due_asc"}).json()
        assert [t["title"] for t in asc] == ["sooner", "later"]
        desc = client.get("/api/tasks", params={"sort": "due_desc"}).json()
        assert [t["title"] for t in desc] == ["later", "sooner"]

    def test_deleted_tasks_not_listed(self, client, make_task):
        task = make_task()
        client.delete(f"/api/tasks/{task['id']}")
        assert client.get("/api/tasks").json() == []