import type { ReactNode } from "react";
import type { Task } from "../services/types";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  empty?: ReactNode;
  labelledBy?: string;
}

export function TaskList({
  tasks,
  onToggle,
  onEdit,
  onDelete,
  empty,
  labelledBy,
}: TaskListProps) {
  if (tasks.length === 0) {
    return <>{empty ?? null}</>;
  }

  return (
    <ul className="task-list" aria-labelledby={labelledBy}>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}