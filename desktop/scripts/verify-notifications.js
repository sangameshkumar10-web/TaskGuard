"use strict";

/**
 * Integration check for the backend -> desktop notification pipeline.
 *
 * It exercises the real path up to (but NOT including) the Windows toast:
 *   1. start the loopback notify listener (same module Electron uses)
 *   2. spawn the real FastAPI backend from backend/.venv with
 *      TASKGUARD_NOTIFY_URL pointing at that listener
 *   3. wait for health, create an overdue task, and assert a valid reminder
 *      payload is delivered
 *
 * It does NOT prove a Windows toast was visually rendered — that must be
 * confirmed manually (see README).
 *
 * Run: npm run verify:notifications
 */

const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { spawn, spawnSync } = require("node:child_process");

const { startNotifyServer } = require("../lib/notify-server");
const backendLib = require("../lib/backend");

const PORT = 8011;
const HOST = "127.0.0.1";
const HEALTH_URL = backendLib.buildHealthUrl(PORT, HOST);
const BASE = `http://${HOST}:${PORT}`;
const BACKEND_DIR = path.join(__dirname, "..", "..", "backend");
const DB_PATH = path.join(os.tmpdir(), `taskguard-verify-${process.pid}.db`);

const received = [];

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const started = await startNotifyServer({
    onNotification: (task) => received.push(task),
  });
  console.log(`[verify] notify listener on ${started.url}`);

  const env = backendLib.buildBackendEnv(process.env, {
    port: PORT,
    host: HOST,
    notifyUrl: started.url,
  });
  env.TASKGUARD_DB_PATH = DB_PATH;
  env.TASKGUARD_REMINDER_POLL_SECONDS = "1";

  const python = backendLib.pythonExecutable(BACKEND_DIR);
  console.log(`[verify] starting backend: ${python}`);
  const child = spawn(python, ["run.py"], {
    cwd: BACKEND_DIR,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[backend] ${d}`));

  let exitCode = 1;
  try {
    const healthy = await backendLib.waitForBackend(HEALTH_URL, { timeoutMs: 30000 });
    if (!healthy) throw new Error("backend never became healthy");
    console.log("[verify] backend healthy");

    const body = {
      title: "Verify overdue notification",
      due_date: yesterdayIso(),
      due_time: "09:00:00",
      priority: "high",
    };
    const response = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status !== 201) {
      throw new Error(`unexpected create status ${response.status}`);
    }
    const task = await response.json();
    console.log(`[verify] created overdue task #${task.id}`);

    const deadline = Date.now() + 15000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }

    if (received.length === 0) {
      throw new Error("no reminder was delivered to the notify listener");
    }
    const note = received.find((n) => n.id === task.id);
    if (!note) {
      throw new Error(`reminder for task #${task.id} not received: ${JSON.stringify(received)}`);
    }
    console.log(
      `[verify] PASS: received ${JSON.stringify(note)} (${received.length} total)`
    );
    exitCode = 0;
  } catch (error) {
    console.error(`[verify] FAIL: ${(error && error.message) || error}`);
  } finally {
    if (child.pid && process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill("SIGTERM");
    }
    started.server.close();
    try {
      fs.rmSync(DB_PATH, { force: true });
    } catch {
      /* ignore */
    }
  }
  process.exit(exitCode);
}

main();
