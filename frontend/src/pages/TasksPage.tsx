import { useState } from "react";
import { useTasks } from "../hooks/useTasks";
import type { Task, TaskInput, TaskQuery } from "../services/types";
import { FilterBar } from "../components/FilterBar";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";

export function TasksPage() {
  const {
    tasks,
    loading,
    error,
    isNetworkError,
    reload,
    query,
    updateQuery,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
  } = useTasks();
  const { showSuccess, showError } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (!saving) setFormOpen(false);
  };

  const handleSubmit = async (input: TaskInput): Promise<string | null> => {
    setSaving(true);
    try {
      if (editing) {
        await updateTask(editing.id, input);
        showSuccess("Task updated successfully");
      } else {
        await createTask(input);
        showSuccess("Task created successfully");
      }
      setFormOpen(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to save task.";
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteTask(deleting.id);
      showSuccess("Task deleted successfully");
      setDeleting(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete task.");
      setDeletingBusy(false);
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      await toggleTask(task);
      showSuccess(task.completed ? "Task reopened" : "Task completed");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update task.");
    }
  };

  const handleQueryChange = (patch: Partial<TaskQuery>) => updateQuery(patch);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            {query.status && query.status !== "all" ? ` — ${query.status}` : ""}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          New task
        </Button>
      </header>

      <FilterBar query={query} onChange={handleQueryChange} />

      {loading ? (
        <Spinner label="Loading tasks" />
      ) : error ? (
        <div className="list-region">
          <ErrorState message={error} onRetry={reload} network={isNetworkError} />
        </div>
      ) : (
        <div className="list-region">
          <TaskList
            tasks={tasks}
            onToggle={handleToggle}
            onEdit={openEdit}
            onDelete={(task) => {
              setDeleting(task);
            }}
            empty={
              <EmptyState
                title="No tasks found"
                message={
                  tasks.length === 0 && !query.search
                    ? "Create your first task to get started."
                    : "Try adjusting the search or filters."
                }
                action={
                  <Button variant="primary" onClick={openCreate}>
                    New task
                  </Button>
                }
              />
            }
          />
        </div>
      )}

      <TaskForm
        open={formOpen}
        task={editing}
        busy={saving}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete task?"
        message={
          deleting
            ? `"${deleting.title}" will be permanently removed. This cannot be undone.`
            : ""
        }
        busy={deletingBusy}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deletingBusy) setDeleting(null);
        }}
      />
    </div>
  );
}