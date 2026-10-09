import { useEffect, useState } from "react";
import type { TaskQuery } from "../services/types";
import {
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from "../services/types";

interface FilterBarProps {
  query: TaskQuery;
  onChange: (patch: Partial<TaskQuery>) => void;
}

export function FilterBar({ query, onChange }: FilterBarProps) {
  const [search, setSearch] = useState(query.search ?? "");

  useEffect(() => {
    setSearch(query.search ?? "");
  }, [query.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() !== (query.search ?? "")) {
        onChange({ search: search.trim() || undefined });
      }
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="filter-bar">
      <input
        className="input"
        type="search"
        placeholder="Search tasks…"
        aria-label="Search tasks"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        className="input input--select"
        aria-label="Filter by status"
        value={query.status ?? "all"}
        onChange={(event) =>
          onChange({ status: event.target.value as TaskQuery["status"] })
        }
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Status: {option.label}
          </option>
        ))}
      </select>
      <select
        className="input input--select"
        aria-label="Filter by priority"
        value={query.priority ?? ""}
        onChange={(event) =>
          onChange({ priority: (event.target.value || undefined) as TaskQuery["priority"] })
        }
      >
        <option value="">All priorities</option>
        {PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} priority
          </option>
        ))}
      </select>
      <select
        className="input input--select"
        aria-label="Sort tasks"
        value={query.sort ?? "due_asc"}
        onChange={(event) => onChange({ sort: event.target.value as TaskQuery["sort"] })}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}