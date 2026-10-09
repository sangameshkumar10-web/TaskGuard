import type { ReactNode, SVGProps } from "react";
import { useBackendStatus } from "../hooks/useBackendStatus";

export type PageKey = "dashboard" | "tasks" | "settings";

interface LayoutProps {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" {...props} aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function TaskIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" {...props} aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 2h12v12H2V2Zm1.2 1.2v9.6h9.6V3.2H3.2Zm1.3 2h7v1.4h-7V5.2Zm0 2.7h7v1.4h-7V7.9Zm0 2.7h4.2v1.4H4.5v-1.4Z"
      />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" {...props} aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm0 1.3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm4.6.3c0-.3 0-.5-.1-.8l1.5-1.2-1.4-2.4-1.9.8a5.3 5.3 0 0 0-1.3-.8L9 1.2H6.3L5.9 3.4c-.4.2-.9.5-1.3.8l-1.9-.8-1.4 2.4 1.5 1.2c0 .3-.1.5-.1.8s0 .5.1.8L1.3 9.8l1.4 2.4 1.9-.8c.4.3.9.6 1.3.8L6.3 14H9l.4-2.2c.4-.2.9-.5 1.3-.8l1.9.8 1.4-2.4-1.5-1.2c.1-.3.1-.5.1-.8ZM6.2 12.5Z"
      />
      <path fill="currentColor" d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

const NAV_ITEMS: { key: PageKey; label: string; icon: (props: SVGProps<SVGSVGElement>) => ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { key: "tasks", label: "Tasks", icon: TaskIcon },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

const STATUS_LABEL = {
  checking: "Checking backend…",
  online: "Backend connected",
  offline: "Backend offline",
} as const;

export function Layout({ page, onNavigate, children }: LayoutProps) {
  const status = useBackendStatus();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 16 16">
              <path
                fill="currentColor"
                d="M8 .8A7.2 7.2 0 1 0 8 15.2 7.2 7.2 0 0 0 8 .8Zm3.9 5.2L7 10.9 4.6 8.5 5.3 7.8 7 9.5l4-4 .9.5Z"
              />
            </svg>
          </span>
          <span className="sidebar__name">TaskGuard</span>
        </div>

        <nav className="sidebar__nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${page === item.key ? "nav-item--active" : ""}`}
                aria-current={page === item.key ? "page" : undefined}
                onClick={() => onNavigate(item.key)}
              >
                <Icon width={17} height={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
          <span className="sidebar__status">{STATUS_LABEL[status]}</span>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}