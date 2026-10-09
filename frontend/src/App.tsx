import { useState } from "react";
import { Layout } from "./components/Layout";
import type { PageKey } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NowProvider } from "./hooks/useNow";
import { ToastProvider } from "./components/ui/Toast";

export function App() {
  const [page, setPage] = useState<PageKey>("dashboard");

  return (
    <NowProvider>
      <ToastProvider>
        <Layout page={page} onNavigate={setPage}>
          {page === "dashboard" ? (
            <DashboardPage />
          ) : page === "tasks" ? (
            <TasksPage />
          ) : (
            <SettingsPage />
          )}
        </Layout>
      </ToastProvider>
    </NowProvider>
  );
}