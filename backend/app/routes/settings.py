"""Settings API routes."""

from __future__ import annotations

from fastapi import APIRouter

from ..models import DeadlineReminderSettings, ReminderIntervalRead
from ..services import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/reminder-interval", response_model=ReminderIntervalRead)
def get_reminder_interval() -> dict:
    return {"value": settings_service.get_reminder_interval_minutes()}


@router.put("/reminder-interval", response_model=ReminderIntervalRead)
def set_reminder_interval(payload: ReminderIntervalRead) -> dict:
    return {"value": settings_service.set_reminder_interval_minutes(payload.value)}


@router.get("/deadline-reminders", response_model=DeadlineReminderSettings)
def get_deadline_reminders() -> dict:
    return {
        "offsets": settings_service.get_reminder_offsets(),
        "enabled": settings_service.deadline_reminders_enabled(),
        "overdue_alerts_enabled": settings_service.overdue_alerts_enabled(),
    }


@router.put("/deadline-reminders", response_model=DeadlineReminderSettings)
def set_deadline_reminders(payload: DeadlineReminderSettings) -> dict:
    offsets = settings_service.set_reminder_offsets(payload.offsets)
    enabled = settings_service.set_deadline_reminders_enabled(payload.enabled)
    overdue_enabled = settings_service.set_overdue_alerts_enabled(payload.overdue_alerts_enabled)
    return {"offsets": offsets, "enabled": enabled, "overdue_alerts_enabled": overdue_enabled}