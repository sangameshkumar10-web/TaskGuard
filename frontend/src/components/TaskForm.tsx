import { useEffect, useState } from "react";
import type { Priority, Task, TaskInput } from "../services/types";
import { fromTimeInput, normalizeDateInput, toTimeInput } from "../services/format";
import { PRIORITY_OPTIONS } from "../services/types";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { Modal } from "./ui/Modal";

interface TaskFormProps {
  open: boolean;
  task: Task | null;
  busy: boolean;
  onClose: () => void;
  /** Returns an error message on failure, or null on success. */
  onSubmit: (input: TaskInput) => Promise<string | null>;
}

interface FormErrors {
  title?: string;
  dueDate?: string;
  scheduledDate?: string;
  form?: string;
}

export function TaskForm({ open, task, busy, onClose, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setDueDate(task.due_date);
      setDueTime(toTimeInput(task.due_time));
      setScheduledDate(task.scheduled_date ?? "");
      setPriority(task.priority);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
      setScheduledDate("");
      setPriority("medium");
    }
    setErrors({});
  }, [open, task]);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!title.trim()) next.title = "Title is required";
    if (!dueDate) {
      next.dueDate = "Due date is required";
    } else if (!normalizeDateInput(dueDate)) {
      next.dueDate = "Enter a valid date (YYYY-MM-DD)";
    }
    if (scheduledDate && !normalizeDateInput(scheduledDate)) {
      next.scheduledDate = "Enter a valid date (YYYY-MM-DD)";
    }
    return next;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    const input: TaskInput = {
      title: title.trim(),
      description: description.trim(),
      due_date: normalizeDateInput(dueDate) ?? dueDate,
      due_time: fromTimeInput(dueTime),
      scheduled_date: scheduledDate ? (normalizeDateInput(scheduledDate) ?? scheduledDate) : null,
      priority,
    };
    const error = await onSubmit(input);
    if (error) {
      setErrors({ form: error });
    }
  };

  return (
    <Modal
      open={open}
      title={task ? "Edit task" : "New task"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} busy={busy}>
            {task ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label="Title" htmlFor="task-title" error={errors.title}>
          <input
            id="task-title"
            className="input"
            type="text"
            placeholder="What needs to be done?"
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="Description" htmlFor="task-description" hint="Optional">
          <textarea
            id="task-description"
            className="input input--textarea"
            placeholder="Add details…"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="form__row">
          <Field label="Due date" htmlFor="task-date" error={errors.dueDate}>
            <input
              id="task-date"
              className="input"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>

          <Field label="Due time" htmlFor="task-time" hint="Optional">
            <input
              id="task-time"
              className="input"
              type="time"
              value={dueTime}
              onChange={(event) => setDueTime(event.target.value)}
            />
          </Field>
        </div>

        <div className="form__row">
          <Field label="Scheduled for" htmlFor="task-scheduled-date" hint="Optional - when to work on this">
            <input
              id="task-scheduled-date"
              className="input"
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
          </Field>

          <Field label="Priority" htmlFor="task-priority">
            <select
              id="task-priority"
              className="input input--select"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {errors.form ? <p className="form__error" role="alert">{errors.form}</p> : null}
      </div>
    </Modal>
  );
}