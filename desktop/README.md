# TaskGuard Desktop (Electron)

Electron shell for TaskGuard. It owns the FastAPI backend lifecycle and turns
overdue reminders into **real Windows notifications**.

> The backend is the single reminder scheduler. Electron never polls for
> overdue tasks; it only receives already-scheduled reminders over loopback.

## How it fits together

```
backend reminder sweep (FastAPI)
        │  POST JSON  http://127.0.0.1:<ephemeral>/notify
        ▼
desktop lib/notify-server.js  ──validates──▶  Electron main
                                                   │
                                                   ▼
                                        Windows notification (Notification API)
```

In production the built frontend (`frontend/dist`) is served by the FastAPI
backend at `http://127.0.0.1:8000/`, so the UI's relative `/api` calls stay
same-origin — no CORS changes and no frontend rewrite. The backend still binds
to `127.0.0.1` only.

## Prerequisites

- Node.js 18+ (tested with Node 24) and npm.
- Backend virtualenv at `backend/.venv` with dependencies installed
  (`backend/.venv/Scripts/python.exe`).
- Frontend dependencies installed (`frontend/node_modules`).

## Install

```powershell
# from E:\TaskGuard\desktop
npm install
npm run icon            # generates assets/icon.png (tray/window icon)
```

## Development

1. Start the Vite dev server (proxies `/api` to `127.0.0.1:8000`):

   ```powershell
   # from E:\TaskGuard\frontend
   npm run dev
   ```

2. Launch Electron in dev mode (loads `http://127.0.0.1:5173`). Electron starts
   the backend for you:

   ```powershell
   # from E:\TaskGuard\desktop
   npm run dev
   ```

## Production

1. Build the frontend:

   ```powershell
   # from E:\TaskGuard\frontend
   npm run build
   ```

2. Launch Electron in production mode (loads the built UI from the backend):

   ```powershell
   # from E:\TaskGuard\desktop
   npm start
   ```

## Tray and window behaviour

- Closing the window **hides it to the system tray**; the backend keeps running
  so reminders continue.
- Tray menu: **Open TaskGuard** (show window) and **Quit**.
- **Quit** shuts down the backend child process and exits cleanly.

## Manual test: real Windows overdue notification

1. Launch in production mode: `npm start` (backend must be healthy; window opens).
2. Create a task due in the past, e.g. via the UI, or:

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/tasks `
     -ContentType 'application/json' `
     -Body '{"title":"Overdue demo","due_date":"2000-01-01","due_time":"09:00:00","priority":"high"}'
   ```

3. Within one poll cycle (default 30s, immediately on backend start) a Windows
   toast titled **"TaskGuard — Overdue task"** with body
   `Task "Overdue demo" is overdue (due 2000-01-01 09:00:00).` should appear.
4. Complete or delete the task; it must **not** be notified again.
5. Close the window (X). Confirm it disappears from the taskbar but the tray
   icon remains and the app keeps running (reopen via tray → Open TaskGuard).
6. Tray → **Quit**. Confirm the app exits and the backend process is gone
   (`Get-Process python` should not list the TaskGuard backend).

> Only report a notification as tested if you actually saw the toast. Automated
> checks below verify delivery to the Electron listener, **not** the visual
> Windows toast.

## Automated checks

```powershell
# backend unit tests (from E:\TaskGuard)
backend\.venv\Scripts\python.exe -m pytest

# Electron/lib unit tests (from E:\TaskGuard\desktop)
npm test

# backend -> notify-listener pipeline (no toast rendering)
npm run verify:notifications
```

## Optional Windows startup

TaskGuard does **not** modify system startup settings on its own. If you want
notifications after sign-in, add a shortcut yourself:

1. Create a shortcut to your launcher (`npm start` via `electron .`, or a
   packaged `.exe`).
2. Press `Win+R`, run `shell:startup`, and place the shortcut in that folder.

Remove the shortcut to undo it. Reminders only fire while the app is running;
nothing works after a full Quit or a reboot if it is not started.

## Security notes

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Preload exposes only `taskguard.getAppInfo()` and
  `taskguard.getBackendStatus()`; no filesystem, shell, or process access.
- IPC handlers reject senders whose URL is not the app origin.
- The notify listener binds to `127.0.0.1` only, caps body size, requires
  `POST /notify`, and validates every field before showing a notification.
- Backend remains bound to `127.0.0.1`; no public exposure.
- No secrets are stored in source.

## Limitations (honest)

- Notifications require the app (and backend) to be running. A full Quit or an
  offline machine stops all reminders.
- Windows "Focus assist"/notification settings or a disabled system app
  identity can suppress toasts; `Notification.isSupported()` is checked and
  failures are logged.
- The desktop app runs the frontend from `http://127.0.0.1:8000/` in production
  rather than `file://`, so relative `/api` calls work without CORS.
