"""Task CRUD business logic.

Every SQL statement is parameterized. Dynamic identifiers (column list, ORDER BY)
are chosen from fixed whitelists, never from user input.
"""

from __future__ import annotations

import sqlite3
from datetime import date as date_cls
from datetime import datetime
from datetime import time as time_cls
from typing import Optional

from ..database import get_connection
from ..models import Priority, TaskCreate, TaskSort, TaskStatus, TaskUpdate
from ..timeutils import (
    is_deadline_passed,
    local_now,
    task_deadline,
    to_utc,
    utc_now_iso,
)
from . import notification_service

_COLUMNS = (
    "id, title, description, due_date, due_time, scheduled_date, priority, "
    "completed, deleted, created_at, updated_at, last_notified_at"
)

_ORDER_BY = {
    TaskSort.due_asc: "due_date ASC, COALESCE(due_time, '00:00:00') ASC, id ASC",
    TaskSort.due_desc: "due_date DESC, COALESCE(due_time, '00:00:00') DESC, id DESC",
    TaskSort.priority: (
        "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, "
        "due_date ASC"
    ),
    TaskSort.created_desc: "created_at DESC, id DESC",
    TaskSort.created_asc: "created_at ASC, id ASC",
}


def _deadline_from_row(row: sqlite3.Row):
    due_date = date_cls.fromisoformat(row["due_date"])
    due_time = time_cls.fromisoformat(row["due_time"]) if row["due_time"] else None
    return task_deadline(due_date, due_time)


def _row_to_dict(row: sqlite3.Row, now=None) -> dict:
    now = now or local_now()
    data = dict(row)
    data["completed"] = bool(data["completed"])
    data["deleted"] = bool(data["deleted"])
    deadline_local = _deadline_from_row(row)
    # Expose the deadline as an exact UTC instant so the UI can count down to it
    # without guessing at timezones. Overdue uses the same instant, inclusive.
    data["deadline_at"] = to_utc(deadline_local).isoformat()
    data["is_overdue"] = (not data["completed"]) and is_deadline_passed(
        deadline_local, now
    )
    # scheduled_date is already a string in ISO format from the DB
    if data.get("scheduled_date"):
        data["scheduled_date"] = data["scheduled_date"]
    return data


def create_task(payload: TaskCreate) -> dict:
    now = utc_now_iso()
    due_time = payload.due_time.strftime("%H:%M:%S") if payload.due_time else None
    scheduled_date = payload.scheduled_date.isoformat() if payload.scheduled_date else None
    with get_connection() as conn:
        cursor = conn.execute(
            f"""
            INSERT INTO tasks
                (title, description, due_date, due_time, scheduled_date, priority,
                 completed, deleted, created_at, updated_at, last_notified_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)
            """,
            (
                payload.title,
                payload.description,
                payload.due_date.isoformat(),
                due_time,
                scheduled_date,
                payload.priority.value,
                now,
                now,
            ),
        )
        task_id = cursor.lastrowid
        row = conn.execute(
            f"SELECT {_COLUMNS} FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
    return _row_to_dict(row)


def get_task(task_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            f"SELECT {_COLUMNS} FROM tasks WHERE id = ? AND deleted = 0",
            (task_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def list_tasks(
    search: Optional[str] = None,
    priority: Optional[Priority] = None,
    status: TaskStatus = TaskStatus.all,
    sort: TaskSort = TaskSort.due_asc,
    scheduled_date: Optional[str] = None,
) -> list[dict]:
    query = f"SELECT {_COLUMNS} FROM tasks WHERE deleted = 0"
    params: list = []

    if search and search.strip():
        like = f"%{search.strip()}%"
        query += " AND (title LIKE ? OR description LIKE ?)"
        params.extend([like, like])

    if priority is not None:
        query += " AND priority = ?"
        params.append(priority.value if isinstance(priority, Priority) else priority)

    if status == TaskStatus.completed:
        query += " AND completed = 1"
    elif status == TaskStatus.pending:
        query += " AND completed = 0"

    if scheduled_date:
        query += " AND scheduled_date = ?"
        params.append(scheduled_date)

    order = _ORDER_BY.get(sort, _ORDER_BY[TaskSort.due_asc])
    query += f" ORDER BY {order}"

    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()

    now = local_now()
    tasks = [_row_to_dict(row, now) for row in rows]

    if status == TaskStatus.overdue:
        tasks = [task for task in tasks if task["is_overdue"]]

    return tasks


def update_task(task_id: int, payload: TaskUpdate) -> Optional[dict]:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return get_task(task_id)

    # Moving a deadline re-arms reminders for the new time: drop the previous
    # overdue marker and any pre-deadline stage markers for this task.
    deadline_changed = "due_date" in fields or "due_time" in fields

    assignments: list[str] = []
    params: list = []
    for key, value in fields.items():
        if key == "due_date" and value is not None:
            value = value.isoformat()
        elif key == "due_time":
            value = value.strftime("%H:%M:%S") if value is not None else None
        elif key == "scheduled_date":
            value = value.isoformat() if value is not None else None
        elif key == "priority" and value is not None:
            value = value.value
        elif key == "completed":
            value = 1 if value else 0
        assignments.append(f"{key} = ?")
        params.append(value)

    if deadline_changed:
        assignments.append("last_notified_at = ?")
        params.append(None)

    assignments.append("updated_at = ?")
    params.append(utc_now_iso())
    params.append(task_id)

    with get_connection() as conn:
        conn.execute(
            f"UPDATE tasks SET {', '.join(assignments)} "
            f"WHERE id = ? AND deleted = 0",
            params,
        )
        row = conn.execute(
            f"SELECT {_COLUMNS} FROM tasks WHERE id = ? AND deleted = 0",
            (task_id,),
        ).fetchone()

    if row is None:
        return None
    if deadline_changed:
        notification_service.clear_for_task(task_id)
    return _row_to_dict(row)


def set_completed(task_id: int, completed: bool) -> Optional[dict]:
    result = update_task(task_id, TaskUpdate(completed=completed))
    if result is not None and completed:
        # Completing a task stops all future deadline/overdue alerts.
        # If the user later marks it incomplete, reminders re-arm from the
        # current state.
        notification_service.clear_for_task(task_id)
    return result


def mark_notified(task_id: int, when: datetime) -> bool:
    """Record the last-overdue-notification time for a live task.

    Refuses to touch completed or soft-deleted tasks, guaranteeing they can
    never be marked (or notified again) after being finished.
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE tasks SET last_notified_at = ? "
            "WHERE id = ? AND completed = 0 AND deleted = 0",
            (when.isoformat(), task_id),
        )
        return cursor.rowcount > 0


def delete_task(task_id: int) -> bool:
    """Soft-delete a task. Returns True if a live task was affected."""
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE tasks SET deleted = 1, updated_at = ? "
            "WHERE id = ? AND deleted = 0",
            (utc_now_iso(), task_id),
        )
        affected = cursor.rowcount
    if affected:
        notification_service.clear_for_task(task_id)
    return affected > 0
