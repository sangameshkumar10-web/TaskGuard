import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { useToast } from "./ui/Toast";

type NotificationPermission = "default" | "granted" | "denied";

export function BrowserNotificationSettings() {
  const { showSuccess, showError, showInfo } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
      setEnabled(Notification.permission === "granted");
    } else {
      setPermission("denied");
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      showError("Browser notifications are not supported in this browser.");
      return;
    }

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setEnabled(result === "granted");
      if (result === "granted") {
        showSuccess("Browser notifications enabled");
        // Show a test notification
        new Notification("TaskGuard", {
          body: "Browser notifications are now enabled. You'll receive deadline reminders.",
          icon: "/icon.png",
        });
      } else if (result === "denied") {
        showError("Browser notifications were blocked. You can enable them in your browser settings.");
      } else {
        showInfo("Notification permission dismissed. You can try again later.");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to request permission");
    } finally {
      setLoading(false);
    }
  };

  if (!("Notification" in window)) {
    return (
      <Field label="Browser notifications" htmlFor="browser-notifications-unsupported" hint="Not supported in this browser">
        <div className="field__hint">Your browser does not support the Notifications API.</div>
      </Field>
    );
  }

  return (
    <>
      <Field
        label="Browser notifications"
        htmlFor="browser-notifications-enabled"
        hint={permission === "denied" ? "Blocked by browser — enable in browser settings" : undefined}
      >
        <label className="field__checkbox">
          <input
            id="browser-notifications-enabled"
            type="checkbox"
            checked={enabled}
            onChange={() => {
              if (!enabled) {
                requestPermission();
              } else {
                setEnabled(false);
                showInfo("Browser notifications disabled");
              }
            }}
            disabled={loading || permission === "denied"}
          />
          <span>{enabled ? "Enabled" : permission === "denied" ? "Blocked" : "Disabled"}</span>
        </label>
      </Field>

      {permission === "default" && (
        <div className="settings-actions">
          <Button variant="secondary" onClick={requestPermission} busy={loading} disabled={permission !== "default"}>
            Enable notifications
          </Button>
        </div>
      )}

      {permission === "denied" && (
        <Field label="" htmlFor="browser-notifications-denied-hint">
          <div className="field__hint" style={{ color: "var(--warning)" }}>
            Notifications are blocked. Please enable them in your browser's site settings.
          </div>
        </Field>
      )}
    </>
  );
}