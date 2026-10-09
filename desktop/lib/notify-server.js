"use strict";

/**
 * Loopback-only HTTP listener used as the delivery endpoint for backend
 * reminders.
 *
 * The FastAPI backend stays the single reminder scheduler; when it detects an
 * overdue task it POSTs a small JSON payload to this server (the URL is passed
 * to the backend via TASKGUARD_NOTIFY_URL). Everything that crosses this
 * boundary is validated here before the Electron main process is allowed to
 * turn it into a Windows notification.
 *
 * This module intentionally has no Electron dependency so it can be unit
 * tested with plain Node.
 */

const http = require("node:http");

const MAX_BODY_BYTES = 8 * 1024; // reminders are tiny; cap hard to avoid abuse
const LOOPBACK = "127.0.0.1";
const NOTIFY_PATH = "/notify";

const MAX_TITLE_LENGTH = 200;
const VALID_KINDS = new Set(["overdue", "pre"]);
const MAX_MINUTES_BEFORE = 525600; // 1 year in minutes

/**
 * Validate an incoming reminder payload.
 *
 * Returns a normalized payload object on success, or null when the message is
 * not a well-formed overdue-task reminder. This is the single place where data
 * entering the main process from the network is trusted.
 */
function validateNotification(payload) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  if (typeof payload.id !== "number" || !Number.isInteger(payload.id) || payload.id <= 0) {
    return null;
  }
  if (typeof payload.title !== "string") {
    return null;
  }
  const title = payload.title.trim();
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    return null;
  }
  const dueDate = payload.due_date == null ? null : payload.due_date;
  const dueTime = payload.due_time == null ? null : payload.due_time;
  if (dueDate !== null && (typeof dueDate !== "string" || dueDate.length > 32)) {
    return null;
  }
  if (dueTime !== null && (typeof dueTime !== "string" || dueTime.length > 32)) {
    return null;
  }
  // Optional kind: "overdue" (default) or "pre" (pre-deadline).
  const kind = payload.kind == null ? "overdue" : payload.kind;
  if (typeof kind !== "string" || !VALID_KINDS.has(kind)) {
    return null;
  }
  // minutes_before is required for "pre", ignored for "overdue".
  let minutesBefore = null;
  if (kind === "pre") {
    if (typeof payload.minutes_before !== "number" || !Number.isInteger(payload.minutes_before)) {
      return null;
    }
    if (payload.minutes_before < 1 || payload.minutes_before > MAX_MINUTES_BEFORE) {
      return null;
    }
    minutesBefore = payload.minutes_before;
  }
  const result = { id: payload.id, title, due_date: dueDate, due_time: dueTime, kind };
  if (minutesBefore !== null) {
    result.minutes_before = minutesBefore;
  }
  return result;
}

/**
 * Start the listener.
 *
 * @param {object} options
 * @param {(task: object) => void} options.onNotification  Called for each valid reminder.
 * @param {string} [options.host]  Must remain loopback; defaults to 127.0.0.1.
 * @returns {Promise<{ server: import("node:http").Server, port: number, url: string }>}
 */
function startNotifyServer({ onNotification, host = LOOPBACK } = {}) {
  if (typeof onNotification !== "function") {
    return Promise.reject(new TypeError("onNotification callback is required"));
  }
  if (host !== LOOPBACK && host !== "::1") {
    return Promise.reject(new Error("notify server must bind to loopback only"));
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== "POST" || req.url !== NOTIFY_PATH) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }

      let body = "";
      let tooLarge = false;

      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        if (tooLarge) return;
        body += chunk;
        if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "payload too large" }));
          req.destroy();
        }
      });

      req.on("end", () => {
        if (tooLarge) return;
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
          return;
        }

        const task = validateNotification(parsed);
        if (!task) {
          res.writeHead(422, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid notification payload" }));
          return;
        }

        try {
          onNotification(task);
        } catch {
          // Never fail the request because the UI could not show a toast; the
          // backend treats non-2xx as a delivery failure and would retry.
        }
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });

      req.on("error", () => {
        // Client aborted; nothing to do.
      });
    });

    server.on("error", reject);
    server.listen(0, host, () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://${host}:${port}${NOTIFY_PATH}` });
    });
  });
}

module.exports = {
  startNotifyServer,
  validateNotification,
  MAX_BODY_BYTES,
  NOTIFY_PATH,
  LOOPBACK,
  VALID_KINDS,
  MAX_MINUTES_BEFORE,
};
