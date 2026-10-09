import { countdownFrom, formatCountdown } from "../services/format";
import { useNow } from "../hooks/useNow";

interface CountdownProps {
  deadlineAt: string | null | undefined;
  completed?: boolean;
  className?: string;
}

export function Countdown({ deadlineAt, completed = false, className = "" }: CountdownProps) {
  const now = useNow();
  const countdown = countdownFrom(deadlineAt, now);

  if (!countdown) return null;

  if (completed) {
    return (
      <span className={`countdown countdown--done ${className}`} aria-live="polite">
        Completed
      </span>
    );
  }

  if (countdown.overdue) {
    return (
      <span className={`countdown countdown--overdue ${className}`} aria-live="polite">
        Overdue by {formatCountdown(countdown)}
      </span>
    );
  }

  return (
    <span className={`countdown ${className}`} aria-live="polite">
      In {formatCountdown(countdown)}
    </span>
  );
}