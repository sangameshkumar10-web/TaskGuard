import { useState } from "react";
import { useTasks } from "../hooks/useTasks";
import type { Task, TaskInput } from "../services/types";
import { todayISO, shiftedISO, formatDateFriendly } from "../services/format";
import { StatCard } from "../components/StatCard";
import { TaskList } from "../components/TaskList";
import { TaskForm } from "../components/TaskForm";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { DeadlineTimerCard } from "../components/DeadlineTimerCard";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";

export function DashboardPage() {
  const { tasks, loading, error, isNetworkError, reload, toggleTask, createTask, updateTask } = useTasks();
  const { showSuccess } = useToast();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <Spinner label="Loading My Day" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={reload} network={isNetworkError} />;
  }

  const today = todayISO();
  const tomorrow = shiftedISO(1);
  const yesterday = shiftedISO(-1);

  // Filter tasks for the selected date
  const dayTasks = tasks.filter((task) => {
    const scheduled = task.scheduled_date ?? task.due_date;
    if (scheduled !== selectedDate) return false;
    if (filter === "active" && task.completed) return false;
    if (filter === "completed" && !task.completed) return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase()) &&
        !task.description.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const total = dayTasks.length;
  const completed = dayTasks.filter((t) => t.completed).length;
  const remaining = total - completed;
  const overdue = tasks.filter((t) => t.is_overdue && !t.completed).length;

  const dateLabel = selectedDate === today ? "Today" :
    selectedDate === tomorrow ? "Tomorrow" :
    selectedDate === yesterday ? "Yesterday" :
    formatDateFriendly(selectedDate);

  const goToToday = () => setSelectedDate(today);
  const goToPrevDay = () => setSelectedDate(shiftedISO(-1));
  const goToNextDay = () => setSelectedDate(shiftedISO(1));

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

  return (
    <div className="page">
      <header className="page-header my-day-header">
        <div className="my-day-title">
          <h1 className="page-title">My Day</h1>
          <div className="date-nav">
            <Button variant="ghost" size="sm" onClick={goToPrevDay} aria-label="Previous day">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path fill="currentColor" d="M9.5 12.5 5.5 8 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
            <span className="date-display">{dateLabel}</span>
            <Button variant="ghost" size="sm" onClick={goToNextDay} aria-label="Next day">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path fill="currentColor" d="M6.5 3.5l4 4.5-4 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
            <Button variant="secondary" size="sm" onClick={goToToday} className="today-btn">
              Today
            </Button>
          </div>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{marginRight: "6px"}}>
            <path fill="currentColor" d="M8 2v12M2 8h12"/>
          </svg>
          Add Task
        </Button>
      </header>

      <div className="stat-grid">
        <StatCard label="Total" value={total} tone="neutral" />
        <StatCard label="Completed" value={completed} tone="success" />
        <StatCard label="Remaining" value={remaining} tone="accent" />
        <StatCard label="Overdue" value={overdue} tone="danger" />
      </div>

      <DeadlineTimerCard tasks={tasks} />

      <div className="checklist-section">
        <div className="checklist-toolbar">
          <div className="checklist-filters">
            <select
              className="input input--select"
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "active" | "completed")}
              aria-label="Filter tasks"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <input
              className="input"
              type="search"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tasks"
            />
          </div>
        </div>

        {total === 0 ? (
          <EmptyState
            title={selectedDate === today ? "No tasks for today" : `No tasks for ${dateLabel}`}
            message={
              selectedDate === today
                ? "Add a task to get started with your day."
                : "Tasks scheduled for this day will appear here."
            }
            action={
              <Button variant="primary" onClick={openCreate}>
                Add Task
              </Button>
            }
          />
        ) : (
          <TaskList
            tasks={dayTasks}
            onToggle={toggleTask}
            onEdit={openEdit}
            labelledBy="checklist-heading"
          />
        )}
      </div>

      <TaskForm
        open={formOpen}
        task={editing}
        busy={saving}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />
    </div>
  );
}