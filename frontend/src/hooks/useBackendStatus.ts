import { useEffect, useState } from "react";
import { api } from "../services/api";

export type BackendStatus = "checking" | "online" | "offline";

/** Lightweight, periodic backend reachability probe shown in the sidebar. */
export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      try {
        await api.listTasks({});
        if (!cancelled) setStatus("online");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    void probe();
    const timer = window.setInterval(probe, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return status;
}