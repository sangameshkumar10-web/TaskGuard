"""Pydantic models / schemas for the TaskGuard API."""

from __future__ import annotations

import re
from datetime import date, datetime, time
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import MAX_REMINDER_OFFSETS


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TaskStatus(str, Enum):
    all = "all"
    pending = "pending"
    completed = "completed"
    overdue = "overdue"


class TaskSort(str, Enum):
    due_asc = "due_asc"
    due_desc = "due_desc"
    priority = "priority"
    created_desc = "created_desc"
    created_asc = "created_asc"


def _clean_title(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("title must not be blank")
    return cleaned


def _clean_description(value: str) -> str:
    return value.strip()


def _normalize_date_input(value: object) -> object:
    """Accept common date separators by normalizing to ISO ``YYYY-MM-DD``.

    The UI normally sends ISO, but browsers/clients that fall back to a plain
    text field (or users hand-entering "2026/12/31" / "2026.12.31") would
    otherwise be rejected with a confusing "expected '-'" error. Only
    unambiguous year-first forms are converted; anything else is passed through
    so Pydantic still reports a clear validation error.
    """
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return value
    separated = re.fullmatch(r"(\d{4})[/.](\d{1,2})[/.](\d{1,2})", text)
    if separated:
        year, month, day = separated.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"
    compact = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", text)
    if compact:
        year, month, day = compact.groups()
        return f"{year}-{month}-{day}"
    return value


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    due_date: date
    due_time: Optional[time] = None
    scheduled_date: Optional[date] = None
    priority: Priority = Priority.medium

    _validate_title = field_validator("title")(_clean_title)
    _validate_description = field_validator("description")(_clean_description)
    _normalize_due_date = field_validator("due_date", mode="before")(_normalize_date_input)
    _normalize_scheduled_date = field_validator("scheduled_date", mode="before")(_normalize_date_input)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    """Partial update; only provided fields are applied."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    scheduled_date: Optional[date] = None
    priority: Optional[Priority] = None
    completed: Optional[bool] = None

    _validate_title = field_validator("title")(_clean_title)
    _validate_description = field_validator("description")(_clean_description)
    _normalize_due_date = field_validator("due_date", mode="before")(_normalize_date_input)
    _normalize_scheduled_date = field_validator("scheduled_date", mode="before")(_normalize_date_input)


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    due_date: date
    due_time: Optional[time]
    scheduled_date: Optional[date]
    priority: Priority
    completed: bool
    is_overdue: bool
    # Absolute UTC instant of the local due date/time deadline. The frontend
    # computes its live countdown from this; it is never a stored countdown.
    deadline_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    last_notified_at: Optional[datetime] = None


class ReminderIntervalRead(BaseModel):
    value: int = Field(ge=1, description="Minimum reminder interval in minutes")


class DeadlineReminderSettings(BaseModel):
    """User-configurable pre-deadline reminder offsets.

    ``offsets`` are minutes before the deadline at which one alert fires
    (a task may therefore produce one alert per offset, plus an overdue alert).
    """

    offsets: list[int] = Field(default_factory=list)
    enabled: bool = True
    overdue_alerts_enabled: bool = True

    @field_validator("offsets")
    @classmethod
    def _validate_offsets(cls, value: list[int]) -> list[int]:
        if len(value) > MAX_REMINDER_OFFSETS:
            raise ValueError(
                f"at most {MAX_REMINDER_OFFSETS} reminder offsets are allowed"
            )
        cleaned: list[int] = []
        for item in value:
            try:
                minutes = int(item)
            except (TypeError, ValueError) as exc:
                raise ValueError("offsets must be whole minutes") from exc
            if minutes < 1:
                raise ValueError("offsets must be at least 1 minute")
            cleaned.append(minutes)
        # De-duplicate and order largest-first (furthest reminder first).
        return sorted(set(cleaned), reverse=True)
