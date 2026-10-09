import type { Priority } from "./types";

export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function shiftedISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "HH:MM:SS" or null -> "HH:MM" used by <input type="time"> (empty when none). */
export function toTimeInput(dueTime: string | null): string {
  if (!dueTime) return "";
  const parts = dueTime.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : "";
}

/**
 * Normalize a due date to ISO "YYYY-MM-DD".
 *
 * Native date inputs already emit ISO, but plain-text fallbacks (and users
 * typing "2026/12/31" or "2026.12.31") can produce other separators. Only
 * unambiguous year-first forms are converted; anything else returns null so the
 * form can show a clear validation message instead of a backend error.
 */
export function normalizeDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const separated = trimmed.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (separated) {
    const [, year, month, day] = separated;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  return null;
}

/** "HH:MM" (or "H:MM"/"HH:MM:SS") -> "HH:MM:SS" expected by the backend. */
export function fromTimeInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return trimmed;
  const [, hours, minutes, seconds] = match;
  return `${hours.padStart(2, "0")}:${minutes}:${seconds ?? "00"}`;
}

export function formatDateFriendly(isoDate: string): string {
  if (isoDate === todayISO()) return "Today";
  if (isoDate === shiftedISO(-1)) return "Yesterday";
  if (isoDate === shiftedISO(1)) return "Tomorrow";

  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(hms: string): string {
  const [hours, minutes] = hms.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDue(dueDate: string, dueTime: string | null): string {
  const dateLabel = formatDateFriendly(dueDate);
  return dueTime ? `${dateLabel}, ${formatTime(dueTime)}` : dateLabel;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Parse a deadline_at ISO string to epoch ms; returns null on invalid/missing. */
export function parseDeadline(deadlineAt: string | null | undefined): number | null {
  if (!deadlineAt) return null;
  const ms = Date.parse(deadlineAt);
  return Number.isFinite(ms) ? ms : null;
}

export interface Countdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  overdue: boolean;
}

/**
 * Compute the countdown from a deadline_at ISO string to `nowMs`.
 * Returns null if the deadline is missing/invalid.
 */
export function countdownFrom(deadlineAt: string | null | undefined, nowMs: number): Countdown | null {
  const target = parseDeadline(deadlineAt);
  if (target === null) return null;
  const total = target - nowMs;
  const overdue = total <= 0;
  const abs = Math.abs(total);
  const totalSec = Math.floor(abs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { totalMs: total, days, hours, minutes, seconds, overdue };
}

/** Format a countdown into a human-readable string like "2d 3h 04m 05s". */
export function formatCountdown(c: Countdown): string {
  const parts: string[] = [];
  if (c.days > 0) parts.push(`${c.days}d`);
  if (c.days > 0 || c.hours > 0) parts.push(`${c.hours}h`);
  parts.push(`${c.minutes}m`);
  parts.push(`${String(c.seconds).padStart(2, "0")}s`);
  return parts.join(" ");
}