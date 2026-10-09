import type { DeadlineReminderSettings, ReminderInterval, Task, TaskInput, TaskPatch, TaskQuery } from "./types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the TaskGuard backend at ${BASE}. Make sure it is running on 127.0.0.1:8000.`,
    );
  }

if (!response.ok) {
    throw new ApiError(
      response.status,
      await describeError(response, path),
      await describeDetails(response),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      `Invalid JSON response from ${BASE}${path}`,
    );
  }
  return json as T;
}

async function describeError(response: Response, path?: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        const msgs = detail
          .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : ""))
          .filter((msg) => msg.length > 0);
        if (msgs.length > 0) return msgs.join("; ");
      }
    }
  } catch {
    // body was not JSON; fall through to generic message
  }
  const url = path ? ` (${path})` : "";
  return `Request failed with status ${response.status}.${url}`;
}

async function describeDetails(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildQuery(query: TaskQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.priority) params.set("priority", query.priority);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.sort) params.set("sort", query.sort);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const api = {
  listTasks(query: TaskQuery = {}): Promise<Task[]> {
    return request<Task[]>(`/tasks${buildQuery(query)}`);
  },

  getTask(id: number): Promise<Task> {
    return request<Task>(`/tasks/${id}`);
  },

  createTask(input: TaskInput): Promise<Task> {
    return request<Task>("/tasks", { method: "POST", body: JSON.stringify(input) });
  },

  updateTask(id: number, patch: TaskPatch): Promise<Task> {
    return request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  deleteTask(id: number): Promise<void> {
    return request<void>(`/tasks/${id}`, { method: "DELETE" });
  },

  getReminderInterval(): Promise<ReminderInterval> {
    return request<ReminderInterval>("/settings/reminder-interval");
  },

  setReminderInterval(value: number): Promise<ReminderInterval> {
    return request<ReminderInterval>("/settings/reminder-interval", {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  },

  getDeadlineReminders(): Promise<DeadlineReminderSettings> {
    return request<DeadlineReminderSettings>("/settings/deadline-reminders");
  },

  setDeadlineReminders(settings: DeadlineReminderSettings): Promise<DeadlineReminderSettings> {
    return request<DeadlineReminderSettings>("/settings/deadline-reminders", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },
};