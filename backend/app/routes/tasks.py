"""Task API routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from ..models import Priority, TaskCreate, TaskRead, TaskSort, TaskStatus, TaskUpdate
from ..services import task_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskRead])
def list_tasks(
    search: Optional[str] = Query(default=None, max_length=200),
    priority: Optional[Priority] = None,
    status_param: TaskStatus = Query(default=TaskStatus.all, alias="status"),
    sort: TaskSort = TaskSort.due_asc,
    scheduled_date: Optional[str] = Query(default=None, alias="scheduled_date"),
) -> list[dict]:
    return task_service.list_tasks(
        search=search, priority=priority, status=status_param, sort=sort, scheduled_date=scheduled_date
    )


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> dict:
    return task_service.create_task(payload)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int) -> dict:
    task = task_service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate) -> dict:
    task = task_service.update_task(task_id, payload)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> None:
    if not task_service.delete_task(task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return None