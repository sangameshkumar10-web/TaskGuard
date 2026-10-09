import { Button } from "./Button";
import type { ButtonProps } from "./Button";

interface ErrorStateProps {
  message: string;
  onRetry?: ButtonProps["onClick"];
  network?: boolean;
}

export function ErrorState({ message, onRetry, network = false }: ErrorStateProps) {
  return (
    <div className={`error-state ${network ? "error-state--network" : ""}`} role="alert">
      <div className="error-state__title">{network ? "Backend unavailable" : "Something went wrong"}</div>
      <p className="error-state__message">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}