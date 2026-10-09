import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => string;
  hideToast: (id: string) => void;
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: Toast = { id, type, message, duration, dismissible: true };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => showToast("success", message, duration), [showToast]);
  const showError = useCallback((message: string, duration?: number) => showToast("error", message, duration), [showToast]);
  const showWarning = useCallback((message: string, duration?: number) => showToast("warning", message, duration), [showToast]);
  const showInfo = useCallback((message: string, duration?: number) => showToast("info", message, duration), [showToast]);

  // Auto-dismiss toasts
  useEffect(() => {
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    toasts.forEach((toast) => {
      if (toast.duration && toast.duration > 0 && !timers[toast.id]) {
        timers[toast.id] = setTimeout(() => {
          hideToast(toast.id);
        }, toast.duration);
      }
    });
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, [toasts, hideToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>,
    error: <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm-.75 5.75a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Zm0-2.5a.75.75 0 1 0-1.5.01v.01a.75.75 0 0 0 1.5-.01v-.01Z"/></svg>,
    warning: <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8.06 1.06a1 1 0 0 0-1.12 0L.94 13.94a1 1 0 0 0 1.12 1.42h12.94a1 1 0 0 0 1.12-1.42L9.18 1.06a1 1 0 0 0-1.12 0Zm-.06 10a.75.75 0 0 1-1.5 0V6.75a.75.75 0 0 1 1.5 0v5.31Zm.75-9a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>,
    info: <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm-.75 5.75a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5Zm0-2.5a.75.75 0 1 0-1.5.01v.01a.75.75 0 0 0 1.5-.01v-.01Z"/></svg>,
  };

  const colors: Record<ToastType, string> = {
    success: "var(--success)",
    error: "var(--danger)",
    warning: "var(--warning)",
    info: "var(--accent)",
  };

  return (
    <div
      className="toast"
      style={{ borderLeftColor: colors[toast.type] }}
      role="alert"
      aria-live="assertive"
    >
      <div className="toast-icon" style={{ color: colors[toast.type] }}>
        {icons[toast.type]}
      </div>
      <div className="toast-message">{toast.message}</div>
      {toast.dismissible && (
        <button
          className="toast-dismiss"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path fill="currentColor" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708Z"/>
          </svg>
        </button>
      )}
    </div>
  );
}