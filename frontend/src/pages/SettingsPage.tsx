import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Field } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import { BrowserNotificationSettings } from "../components/BrowserNotificationSettings";

export function SettingsPage() {
  const {
    interval,
    loading,
    error,
    isNetworkError,
    reload,
    saveInterval,
    saving,
    saveError,
    deadlineReminders,
    saveDeadlineReminders,
    savingDeadline,
    saveDeadlineError,
  } = useSettings();
  const [value, setValue] = useState("15");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);
  const [offsetsInput, setOffsetsInput] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [overdueAlertsEnabled, setOverdueAlertsEnabled] = useState(true);
  const [offsetsError, setOffsetsError] = useState<string | null>(null);
  const [deadlineSavedHint, setDeadlineSavedHint] = useState(false);

  useEffect(() => {
    if (interval !== null) {
      setValue(String(interval));
      setDraftError(null);
    }
  }, [interval]);

  useEffect(() => {
    setSavedHint(false);
  }, [value]);

  useEffect(() => {
    if (deadlineReminders !== null) {
      setOffsetsInput(deadlineReminders.offsets.join(", "));
      setEnabled(deadlineReminders.enabled);
      setOverdueAlertsEnabled(deadlineReminders.overdue_alerts_enabled);
    }
  }, [deadlineReminders]);

  useEffect(() => {
    setDeadlineSavedHint(false);
  }, [offsetsInput, enabled, overdueAlertsEnabled]);

  const handleSave = async () => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setDraftError("Enter a whole number of minutes, at least 1.");
      return;
    }
    setDraftError(null);
    const ok = await saveInterval(parsed);
    setSavedHint(ok);
  };

  const parseOffsets = (input: string): number[] => {
    return input
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0);
  };

  const handleSaveDeadline = async () => {
    const offsets = parseOffsets(offsetsInput);
    if (offsets.length === 0) {
      setOffsetsError("Enter at least one positive minute value (e.g. 30, 5).");
      return;
    }
    if (offsets.length > 10) {
      setOffsetsError("At most 10 reminder offsets allowed.");
      return;
    }
    const unique = [...new Set(offsets)];
    if (unique.length !== offsets.length) {
      setOffsetsError("Duplicate offset values are not allowed.");
      return;
    }
    setOffsetsError(null);
    const settings = {
      offsets: unique.sort((a, b) => b - a),
      enabled,
      overdue_alerts_enabled: overdueAlertsEnabled,
    };
    const ok = await saveDeadlineReminders(settings);
    setDeadlineSavedHint(ok);
  };

  if (loading) {
    return <Spinner label="Loading settings" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={reload} network={isNetworkError} />;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Reminder behavior and preferences.</p>
        </div>
      </header>

      <div className="settings-grid">
        <Card>
          <h2 className="card__title">Reminder interval</h2>
          <p className="card__text">
            How often TaskGuard may re-alert you about an overdue task that is
            still incomplete. This is stored locally by the backend.
          </p>
          <Field
            label="Minutes between reminders"
            htmlFor="reminder-interval"
            hint="Minimum: 1 minute"
            error={draftError ?? undefined}
          >
            <input
              id="reminder-interval"
              className="input input--number"
              type="number"
              min={1}
              step={1}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <div className="settings-actions">
            <Button variant="primary" onClick={handleSave} busy={saving}>
              Save reminder interval
            </Button>
            {savedHint ? <span className="settings-saved">Saved.</span> : null}
          </div>
          {saveError ? (
            <div className="banner banner--error" role="alert">
              {saveError}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="card__title">Deadline reminders</h2>
          <p className="card__text">
            One-shot reminders before a task's deadline. Each offset fires exactly
            once per task (e.g. 30 and 5 minutes before). The overdue alert that
            repeats on an interval is controlled separately below.
          </p>
          <Field
            label="Minutes before deadline (comma-separated)"
            htmlFor="deadline-offsets"
            hint="Example: 30, 5"
            error={offsetsError ?? undefined}
          >
            <input
              id="deadline-offsets"
              className="input"
              type="text"
              value={offsetsInput}
              onChange={(event) => setOffsetsInput(event.target.value)}
            />
          </Field>
          <Field label="Enabled" htmlFor="deadline-enabled">
            <label className="field__checkbox">
              <input
                id="deadline-enabled"
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>Enable pre-deadline reminders</span>
            </label>
          </Field>
          <Field label="Overdue alerts" htmlFor="overdue-alerts-enabled">
            <label className="field__checkbox">
              <input
                id="overdue-alerts-enabled"
                type="checkbox"
                checked={overdueAlertsEnabled}
                onChange={(event) => setOverdueAlertsEnabled(event.target.checked)}
              />
              <span>Enable recurring overdue alerts</span>
            </label>
          </Field>
          <div className="settings-actions">
            <Button variant="primary" onClick={handleSaveDeadline} busy={savingDeadline}>
              Save deadline reminders
            </Button>
            {deadlineSavedHint ? <span className="settings-saved">Saved.</span> : null}
          </div>
          {saveDeadlineError ? (
            <div className="banner banner--error" role="alert">
              {saveDeadlineError}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="card__title">Desktop notifications</h2>
          <p className="card__text">
            TaskGuard's reminder engine tracks overdue tasks and honors this
            interval automatically. In the desktop app, overdue alerts appear as
            Windows notifications while TaskGuard is running.
          </p>
          <ul className="settings-list">
            <li>Overdue alerts appear as Windows notifications in the desktop app.</li>
            <li>Notifications are shown by the desktop shell; the web page never requests permission.</li>
            <li>
              Reminders run while the app is open. After a full Quit they are
              detected the next time it starts.
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="card__title">Browser notifications</h2>
          <p className="card__text">
            When using TaskGuard in a browser, you can enable notifications to receive
            deadline reminders even when the tab is not active.
          </p>
          <BrowserNotificationSettings />
        </Card>
      </div>
    </div>
  );
}