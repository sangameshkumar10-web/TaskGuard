import { useCallback, useEffect, useRef, useState } from "react";
import type { DependencyList } from "react";
import { ApiError } from "../services/api";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isNetworkError: boolean;
  reload: () => Promise<void>;
}

/**
 * Runs an async loader, tracking loading / error / success state.
 * Reloads whenever the loader identity changes (deps). A request sequence
 * number guarantees that only the most recent request can update state, so a
 * slow stale response can never overwrite fresher data.
 */
export function useApi<T>(loader: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setIsNetworkError(false);
    try {
      const result = await loaderRef.current();
      if (seq === requestSeq.current) {
        setData(result);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        const network = err instanceof ApiError && err.isNetworkError;
        setError(err instanceof Error ? err.message : "Unexpected error");
        setIsNetworkError(network);
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, isNetworkError, reload };
}