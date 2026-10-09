import type { Task } from "../services/types";
import { formatDue, PRIORITY_LABEL } from "../services/format";
import { Badge } from "./ui/Badge";
import { Countdown } from "./Countdown";

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

function priorityTone(priority: Task["priority"]): "danger" | "warning" | "neutral" {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  return "neutral";
}

export function TaskItem({ task, onToggle, onEdit, onDelete }: TaskItemProps) {
  const tone = task.is_overdue ? "overdue" : task.completed ? "completed" : "upcoming";

  return (
    <li className={`task task--${tone}`}>
      <button
        type="button"
        className="task__check"
        aria-label={task.completed ? "Mark as not completed" : "Mark as completed"}
        role="checkbox"
        aria-checked={task.completed}
        onClick={() => onToggle(task)}
      >
        {task.completed ? (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8.5 6.5 12 13 4.5"
            />
          </svg>
        ) : null}
      </button>

      <div className="task__body">
        <div className="task__heading">
          <span className={`task__title ${task.completed ? "task__title--done" : ""}`}>
            {task.title}
          </span>
          <div className="task__badges">
            {task.is_overdue ? <Badge tone="danger">Overdue</Badge> : null}
            <Badge tone={priorityTone(task.priority)}>{PRIORITY_LABEL[task.priority]} priority</Badge>
          </div>
        </div>
        {task.description ? <p className="task__description">{task.description}</p> : null}
<div className="task__meta">
        <span className={`task__due ${task.is_overdue ? "task__due--overdue" : ""}`}>
          {formatDue(task.due_date, task.due_time)}
        </span>
        <Countdown deadlineAt={task.deadline_at} completed={task.completed} />
      </div>
      </div>

      <div className="task__actions">
        {onEdit ? (
          <button type="button" className="icon-button" aria-label="Edit task" onClick={() => onEdit(task)}>
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M11.3 1.3a1.9 1.9 0 0 1 2.7 2.7L5 13l-3 1 1-3 8.3-8.7ZM10.6 2 9.2 3.4l2.7 2.7L13.3 2a.5.5 0 0 0-.7 0l-.2.2-1.8.8L10.6 2Z"
                transform="translate(0 0)"
              />
            </svg>
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" className="icon-button icon-button--danger" aria-label="Delete task" onClick={() => onDelete(task)}>
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M6 2h4l.5 1H13v1H3V3h2.5L6 2ZM4 5h8l-.6 8.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8L4 5Zm2.5 2v5h1V7h-1Zm2 0v5h1V7h-1Z"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </li>
  );
}