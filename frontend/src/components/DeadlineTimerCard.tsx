import type { Task } from "../services/types";
import { parseDeadline, formatCountdown, countdownFrom, formatDue } from "../services/format";
import { useNow } from "../hooks/useNow";
import { Badge } from "./ui/Badge";

interface DeadlineTimerCardProps {
  tasks: Task[];
}

function getNextUpcoming(tasks: Task[], nowMs: number): Task | null {
  const upcoming = tasks
    .filter(
      (t) =>
        !t.completed &&
        parseDeadline(t.deadline_at) !== null &&
        parseDeadline(t.deadline_at)! > nowMs
    )
    .sort((a, b) => {
      const da = parseDeadline(a.deadline_at);
      const db = parseDeadline(b.deadline_at);
      return (da ?? 0) - (db ?? 0);
    });
  return upcoming[0] ?? null;
}

function getMostOverdue(tasks: Task[], nowMs: number): Task | null {
  const overdue = tasks
    .filter(
      (t) =>
        !t.completed &&
        parseDeadline(t.deadline_at) !== null &&
        parseDeadline(t.deadline_at)! <= nowMs
    )
    .sort((a, b) => {
      const da = parseDeadline(a.deadline_at);
      const db = parseDeadline(b.deadline_at);
      return (db ?? 0) - (da ?? 0);
    });
  return overdue[0] ?? null;
}

export function DeadlineTimerCard({ tasks }: DeadlineTimerCardProps) {
  const now = useNow();
  const next = getNextUpcoming(tasks, now);
  const overdue = !next ? getMostOverdue(tasks, now) : null;

  if (!next && !overdue) {
    return (
      <section className="card deadline-timer" aria-labelledby="deadline-timer-heading">
        <h2 id="deadline-timer-heading" className="card__title">
          Nearest deadline
        </h2>
        <p className="card__text">No upcoming deadlines.</p>
      </section>
    );
  }

  const target = next ?? overdue;
  if (!target) {
    return (
      <section className="card deadline-timer" aria-labelledby="deadline-timer-heading">
        <h2 id="deadline-timer-heading" className="card__title">
          Nearest deadline
        </h2>
        <p className="card__text">No upcoming deadlines.</p>
      </section>
    );
  }

  const countdown = countdownFrom(target.deadline_at, now);
  const isOverdue = !!overdue;
  const prefix = isOverdue ? "Overdue" : "Next deadline";

  return (
    <section className="card deadline-timer" aria-labelledby="deadline-timer-heading">
      <h2 id="deadline-timer-heading" className="card__title">
        {prefix}
      </h2>
      <div className="deadline-timer__task">
        <div className="deadline-timer__title-row">
          <span className={`deadline-timer__title ${isOverdue ? "deadline-timer__title--overdue" : ""}`}>
            {target.title}
          </span>
          <Badge tone={target.priority === "high" ? "danger" : target.priority === "medium" ? "warning" : "neutral"}>
            {target.priority} priority
          </Badge>
        </div>
        {target.description ? (
          <p className="deadline-timer__description">{target.description}</p>
        ) : null}
        <div className="deadline-timer__meta">
          <span className="deadline-timer__due">{formatDue(target.due_date, target.due_time)}</span>
          {countdown ? (
            <span className={`deadline-timer__countdown ${isOverdue ? "deadline-timer__countdown--overdue" : ""}`} aria-live="polite">
              {isOverdue ? `Overdue by ${formatCountdown(countdown)}` : `In ${formatCountdown(countdown)}`}
            </span>
          ) : (
            <span className="deadline-timer__countdown">—</span>
          )}
        </div>
      </div>
    </section>
  );
}