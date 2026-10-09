"use strict";

/**
 * Backend lifecycle helpers (no Electron dependency, unit-testable).
 *
 * Pure-ish helpers around locating the backend interpreter, building the child
 * environment, and polling the health endpoint. Process spawning/killing and
 * dialogs live in main.js.
 */

const path = require("node:path");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8000;

function buildHealthUrl(port = DEFAULT_PORT, host = DEFAULT_HOST) {
  return `http://${host}:${port}/api/health`;
}

function buildAppUrl(port = DEFAULT_PORT, host = DEFAULT_HOST) {
  return `http://${host}:${port}/`;
}

/** The backend health endpoint returns {"status": "ok"}. */
function isHealthyPayload(payload) {
  return Boolean(payload) && typeof payload === "object" && payload.status === "ok";
}

/** Absolute path to the virtualenv interpreter used to run the backend. */
function pythonExecutable(backendDir) {
  const relative =
    process.platform === "win32"
      ? path.join(".venv", "Scripts", "python.exe")
      : path.join(".venv", "bin", "python");
  return path.join(backendDir, relative);
}

/**
 * Build the environment for the backend child process.
 *
 * Forces loopback binding, wires the notify listener URL, and strips any
 * inherited TASKGUARD_NOTIFIER override so the backend always uses its
 * BroadcastNotifier (the real desktop path) rather than the noop/log fallback.
 */
function buildBackendEnv(baseEnv, { port = DEFAULT_PORT, host = DEFAULT_HOST, notifyUrl } = {}) {
  const env = { ...baseEnv };
  env.TASKGUARD_API_HOST = host;
  env.TASKGUARD_API_PORT = String(port);
  delete env.TASKGUARD_NOTIFIER;
  if (notifyUrl) {
    env.TASKGUARD_NOTIFY_URL = notifyUrl;
  } else {
    delete env.TASKGUARD_NOTIFY_URL;
  }
  return env;
}

/** Single health probe. Never throws. */
async function checkHealth(url, { fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return false;
    return isHealthyPayload(await response.json());
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Poll the health endpoint until it reports ok or the timeout elapses. */
async function waitForBackend(
  url,
  { timeoutMs = 30000, intervalMs = 500, fetchImpl = fetch } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkHealth(url, { fetchImpl, timeoutMs: Math.min(1500, intervalMs + 1000) })) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

module.exports = {
  buildHealthUrl,
  buildAppUrl,
  isHealthyPayload,
  pythonExecutable,
  buildBackendEnv,
  checkHealth,
  waitForBackend,
  DEFAULT_HOST,
  DEFAULT_PORT,
};
