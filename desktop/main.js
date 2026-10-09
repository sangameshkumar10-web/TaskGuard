"use strict";

/**
 * TaskGuard Electron main process.
 *
 * Responsibilities:
 *  - Own the backend lifecycle: start the existing FastAPI backend from
 *    backend/.venv/Scripts/python.exe, bound to 127.0.0.1, and wait for its
 *    health endpoint before loading the UI.
 *  - Host a loopback-only notify listener and forward backend reminders as real
 *    Windows notifications (via Electron's Notification API).
 *  - Provide a system tray with Open/Quit and hide-to-tray on window close.
 *  - Clean up child processes on shutdown; never spawn duplicates.
 *
 * The backend remains the single reminder scheduler; Electron never polls for
 * overdue tasks itself.
 */

const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  dialog,
  nativeImage,
} = require("electron");

const backendLib = require("./lib/backend");
const { startNotifyServer } = require("./lib/notify-server");
const { createNotificationQueue } = require("./lib/notifier-queue");

const IS_DEV = process.argv.includes("--dev");
const BACKEND_PORT = Number.parseInt(process.env.TASKGUARD_API_PORT || "8000", 10) || 8000;
const BACKEND_HOST = "127.0.0.1";
const DEV_SERVER_URL = "http://127.0.0.1:5173";
const APP_ORIGIN = IS_DEV ? DEV_SERVER_URL : backendLib.buildAppUrl(BACKEND_PORT, BACKEND_HOST);

const PROJECT_ROOT = path.join(__dirname, "..");
const BACKEND_DIR = path.join(PROJECT_ROOT, "backend");
const ICON_PATH = path.join(__dirname, "assets", "icon.png");
const HEALTH_URL = backendLib.buildHealthUrl(BACKEND_PORT, BACKEND_HOST);

const notificationQueue = createNotificationQueue({ cooldownMs: 5000 });

let mainWindow = null;
let tray = null;
let backendProcess = null;
let weStartedBackend = false;
let notifyServer = null;
let notifyUrl = null;
let isQuitting = false;

// --------------------------------------------------------------------------
// Icon helpers
// --------------------------------------------------------------------------

function loadIcon(size) {
  const image = nativeImage.createFromPath(ICON_PATH);
  if (image.isEmpty()) return nativeImage.createEmpty();
  return size ? image.resize({ width: size, height: size }) : image;
}

// --------------------------------------------------------------------------
// Notifications
// --------------------------------------------------------------------------

function formatDue(task) {
  return task.due_time ? `${task.due_date} ${task.due_time}` : task.due_date;
}

function showTaskNotification(task) {
  if (!Notification.isSupported()) {
    console.warn(
      `[notify] Windows notifications are unavailable; skipping task #${task.id}.`
    );
    return;
  }
  if (!notificationQueue.shouldShow(task.id)) {
    return; // duplicate delivery within the cooldown window
  }

  const kind = task.kind || "overdue";
  let title, body;
  if (kind === "pre") {
    title = "TaskGuard — Deadline approaching";
    body = `Task "${task.title}" is due in ${task.minutes_before} minute(s) (due ${formatDue(task)}).`;
  } else {
    title = "TaskGuard — Overdue task";
    body = task.due_date
      ? `Task "${task.title}" is overdue (due ${formatDue(task)}).`
      : `Task "${task.title}" is overdue.`;
  }

  const notification = new Notification({
    title,
    body,
    icon: ICON_PATH,
  });
  notification.on("click", () => showMainWindow());
  notification.show();
}

// --------------------------------------------------------------------------
// Backend lifecycle
// --------------------------------------------------------------------------

function spawnBackend() {
  if (backendProcess) return; // never launch a duplicate child

  const python = backendLib.pythonExecutable(BACKEND_DIR);
  const env = backendLib.buildBackendEnv(process.env, {
    port: BACKEND_PORT,
    host: BACKEND_HOST,
    notifyUrl,
  });

  console.log(`[backend] starting ${python} run.py (port ${BACKEND_PORT})`);
  backendProcess = spawn(python, ["run.py"], {
    cwd: BACKEND_DIR,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  weStartedBackend = true;

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });
  backendProcess.stderr.on("data", (data) => {
    console.error(`[backend] ${data.toString().trim()}`);
  });
  backendProcess.on("error", (error) => {
    console.error("[backend] failed to start", error);
  });
  backendProcess.on("exit", (code, signal) => {
    backendProcess = null;
    if (isQuitting) return;
    console.error(`[backend] exited unexpectedly (code=${code}, signal=${signal})`);
    dialog.showErrorBox(
      "TaskGuard backend stopped",
      "The TaskGuard backend exited unexpectedly, so reminders can no longer run. TaskGuard will now close."
    );
    isQuitting = true;
    app.quit();
  });
}

/** Start the backend, or reuse one that is already healthy on the port. */
async function ensureBackend() {
  if (await backendLib.checkHealth(HEALTH_URL)) {
    console.log("[backend] reusing already-running backend");
    weStartedBackend = false;
    return;
  }
  spawnBackend();
  const healthy = await backendLib.waitForBackend(HEALTH_URL, {
    timeoutMs: 30000,
    intervalMs: 500,
  });
  if (!healthy) {
    throw new Error(
      `Backend did not become healthy at ${HEALTH_URL} within 30s.`
    );
  }
  console.log("[backend] healthy");
}

function stopBackend() {
  const child = backendProcess;
  backendProcess = null;
  if (!child || !weStartedBackend) return;
  weStartedBackend = false;
  try {
    if (child.pid && process.platform === "win32") {
      // Kill the uvicorn process tree; a plain kill can leave reloader children.
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch (error) {
    console.error("[backend] failed to stop cleanly", error);
  }
}

// --------------------------------------------------------------------------
// Window / tray
// --------------------------------------------------------------------------

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: loadIcon(),
    title: "TaskGuard",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Closing hides to tray; the backend keeps running.
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) event.preventDefault();
  });

  if (IS_DEV) {
    console.log(`[window] loading dev server ${DEV_SERVER_URL}`);
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    const appUrl = backendLib.buildAppUrl(BACKEND_PORT, BACKEND_HOST);
    console.log(`[window] loading built frontend ${appUrl}`);
    mainWindow.loadURL(appUrl);
  }
}

function createTray() {
  const icon = loadIcon(16);
  tray = new Tray(icon);
  tray.setToolTip("TaskGuard");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open TaskGuard", click: () => showMainWindow() },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("double-click", () => showMainWindow());
}

// --------------------------------------------------------------------------
// IPC (renderer -> main). Only these two channels exist.
// --------------------------------------------------------------------------

function isTrustedSender(event) {
  const url = (event.senderFrame && event.senderFrame.url) || "";
  return url.startsWith(APP_ORIGIN);
}

function registerIpc() {
  ipcMain.handle("taskguard:app-info", (event) => {
    if (!isTrustedSender(event)) return null;
    return {
      name: "TaskGuard",
      version: app.getVersion(),
      platform: process.platform,
      notificationsSupported: Notification.isSupported(),
      backendPort: BACKEND_PORT,
    };
  });

  ipcMain.handle("taskguard:backend-status", async (event) => {
    if (!isTrustedSender(event)) return { online: false };
    return { online: await backendLib.checkHealth(HEALTH_URL) };
  });
}

// --------------------------------------------------------------------------
// Bootstrap
// --------------------------------------------------------------------------

async function bootstrap() {
  app.setAppUserModelId("com.taskguard.desktop");
  registerIpc();

  try {
    const started = await startNotifyServer({
      onNotification: showTaskNotification,
    });
    notifyServer = started.server;
    notifyUrl = started.url;
    console.log(`[notify] listening on ${notifyUrl}`);
  } catch (error) {
    notifyUrl = null;
    console.error("[notify] listener unavailable; desktop notifications disabled", error);
  }

  try {
    await ensureBackend();
  } catch (error) {
    dialog.showErrorBox(
      "TaskGuard could not start",
      String((error && error.message) || error)
    );
    isQuitting = true;
    app.quit();
    return;
  }

  createWindow();
  createTray();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(bootstrap);

  app.on("window-all-closed", () => {
    // Keep running in the tray; only an explicit Quit stops the app/backend.
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("will-quit", () => {
    stopBackend();
    if (notifyServer) {
      notifyServer.close();
      notifyServer = null;
    }
  });
}
