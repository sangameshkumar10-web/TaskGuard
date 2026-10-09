export type Priority = "low" | "medium" | "high";
export type TaskStatus = "all" | "pending" | "completed" | "overdue";
export type TaskSort =
  | "due_asc"
  | "due_desc"
  | "priority"
  | "created_desc"
  | "created_asc";

export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  due_time: string | null;
  scheduled_date: string | null;
  priority: Priority;
  completed: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  last_notified_at: string | null;
  // Absolute UTC instant of the local due date/time deadline. The frontend
  // computes its live countdown from this; it is never a stored countdown.
  deadline_at: string | null;
}

export interface TaskInput {
  title: string;
  description?: string;
  due_date: string;
  due_time?: string | null;
  scheduled_date?: string | null;
  priority?: Priority;
}

export type TaskPatch = Partial<TaskInput> & { completed?: boolean };

export interface TaskQuery {
  search?: string;
  priority?: Priority;
  status?: TaskStatus;
  sort?: TaskSort;
}

export interface ReminderInterval {
  value: number;
}

export interface DeadlineReminderSettings {
  offsets: number[];
  enabled: boolean;
  overdue_alerts_enabled: boolean;
}

export const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: "due_asc", label: "Due date (soonest first)" },
  { value: "due_desc", label: "Due date (latest first)" },
  { value: "priority", label: "Priority" },
  { value: "created_desc", label: "Created (newest first)" },
  { value: "created_asc", label: "Created (oldest first)" },
];