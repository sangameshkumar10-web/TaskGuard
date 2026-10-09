import { useCallback, useState } from "react";
import { api } from "../services/api";
import type { DeadlineReminderSettings } from "../services/types";
import { useApi } from "./useApi";

export interface UseSettingsResult {
  interval: number | null;
  loading: boolean;
  error: string | null;
  isNetworkError: boolean;
  reload: () => Promise<void>;
  saveInterval: (value: number) => Promise<boolean>;
  saving: boolean;
  saveError: string | null;
  deadlineReminders: DeadlineReminderSettings | null;
  saveDeadlineReminders: (settings: DeadlineReminderSettings) => Promise<boolean>;
  savingDeadline: boolean;
  saveDeadlineError: string | null;
}

export function useSettings(): UseSettingsResult {
  const { data: intervalData, loading: intervalLoading, error: intervalError, isNetworkError: intervalNetworkError, reload: intervalReload } = useApi(
    () => api.getReminderInterval(),
    []
  );
  const { data: deadlineData, loading: deadlineLoading, error: deadlineError, isNetworkError: deadlineNetworkError, reload: deadlineReload } = useApi(
    () => api.getDeadlineReminders(),
    []
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [saveDeadlineError, setSaveDeadlineError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    await Promise.all([intervalReload(), deadlineReload()]);
  }, [intervalReload, deadlineReload]);

  const saveInterval = useCallback(
    async (value: number): Promise<boolean> => {
      setSaving(true);
      setSaveError(null);
      try {
        await api.setReminderInterval(value);
        await intervalReload();
        return true;
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save settings");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [intervalReload]
  );

  const saveDeadlineReminders = useCallback(
    async (settings: DeadlineReminderSettings): Promise<boolean> => {
      setSavingDeadline(true);
      setSaveDeadlineError(null);
      try {
        await api.setDeadlineReminders(settings);
        await deadlineReload();
        return true;
      } catch (err) {
        setSaveDeadlineError(err instanceof Error ? err.message : "Failed to save deadline reminders");
        return false;
      } finally {
        setSavingDeadline(false);
      }
    },
    [deadlineReload]
  );

  return {
    interval: intervalData?.value ?? null,
    loading: intervalLoading || deadlineLoading,
    error: intervalError || deadlineError,
    isNetworkError: intervalNetworkError || deadlineNetworkError,
    reload,
    saveInterval,
    saving,
    saveError,
    deadlineReminders: deadlineData ?? null,
    saveDeadlineReminders,
    savingDeadline,
    saveDeadlineError,
  };
}