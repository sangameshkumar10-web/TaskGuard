import { useCallback, useState } from "react";
import { api } from "../services/api";
import type { Task, TaskInput, TaskPatch, TaskQuery } from "../services/types";
import { useApi } from "./useApi";

export interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  isNetworkError: boolean;
  query: TaskQuery;
  reload: () => Promise<void>;
  updateQuery: (patch: Partial<TaskQuery>) => void;
  createTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: number, patch: TaskPatch) => Promise<Task>;
  deleteTask: (id: number) => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const [query, setQuery] = useState<TaskQuery>({ status: "all", sort: "due_asc" });
  const { data, loading, error, isNetworkError, reload } = useApi(
    () => api.listTasks(query),
    [query],
  );

  const updateQuery = useCallback((patch: Partial<TaskQuery>) => {
    setQuery((previous) => ({ ...previous, ...patch }));
  }, []);

  const createTask = useCallback(
    async (input: TaskInput) => {
      const created = await api.createTask(input);
      await reload();
      return created;
    },
    [reload],
  );

  const updateTask = useCallback(
    async (id: number, patch: TaskPatch) => {
      const updated = await api.updateTask(id, patch);
      await reload();
      return updated;
    },
    [reload],
  );

  const deleteTask = useCallback(
    async (id: number) => {
      await api.deleteTask(id);
      await reload();
    },
    [reload],
  );

  const toggleTask = useCallback(
    async (task: Task) => {
      await updateTask(task.id, { completed: !task.completed });
    },
    [updateTask],
  );

  return {
    tasks: data ?? [],
    loading,
    error,
    isNetworkError,
    query,
    reload,
    updateQuery,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
  };
}