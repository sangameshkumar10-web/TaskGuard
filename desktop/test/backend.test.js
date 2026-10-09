"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backend = require("../lib/backend");

test("buildHealthUrl targets loopback", () => {
  assert.equal(backend.buildHealthUrl(8000), "http://127.0.0.1:8000/api/health");
  assert.equal(backend.buildAppUrl(8000), "http://127.0.0.1:8000/");
});

test("isHealthyPayload only accepts status ok", () => {
  assert.equal(backend.isHealthyPayload({ status: "ok" }), true);
  assert.equal(backend.isHealthyPayload({ status: "down" }), false);
  assert.equal(backend.isHealthyPayload(null), false);
  assert.equal(backend.isHealthyPayload("ok"), false);
});

test("pythonExecutable points at the venv interpreter", () => {
  const exe = backend.pythonExecutable("C:\\TaskGuard\\backend");
  assert.ok(exe.startsWith("C:\\TaskGuard\\backend"));
  assert.match(exe, /\.venv[\\/]Scripts[\\/]python\.exe$|\.venv[\\/]bin[\\/]python$/);
});

test("buildBackendEnv forces loopback and wires the notify url", () => {
  const env = backend.buildBackendEnv(
    { PATH: "x", TASKGUARD_NOTIFIER: "noop", TASKGUARD_NOTIFY_URL: "http://evil" },
    { port: 8123, notifyUrl: "http://127.0.0.1:5/notify" }
  );
  assert.equal(env.TASKGUARD_API_HOST, "127.0.0.1");
  assert.equal(env.TASKGUARD_API_PORT, "8123");
  assert.equal(env.TASKGUARD_NOTIFY_URL, "http://127.0.0.1:5/notify");
  assert.equal(env.TASKGUARD_NOTIFIER, undefined);
  assert.equal(env.PATH, "x");
});

test("buildBackendEnv removes notify url when absent", () => {
  const env = backend.buildBackendEnv({ TASKGUARD_NOTIFY_URL: "http://old" }, {});
  assert.equal(env.TASKGUARD_NOTIFY_URL, undefined);
});

test("checkHealth returns false on network error", async () => {
  const failing = async () => {
    throw new Error("refused");
  };
  assert.equal(await backend.checkHealth("http://127.0.0.1:1/api/health", { fetchImpl: failing }), false);
});

test("checkHealth reads the health payload", async () => {
  const ok = async () => ({ ok: true, json: async () => ({ status: "ok" }) });
  assert.equal(await backend.checkHealth("http://x", { fetchImpl: ok }), true);

  const notOk = async () => ({ ok: true, json: async () => ({ status: "down" }) });
  assert.equal(await backend.checkHealth("http://x", { fetchImpl: notOk }), false);
});

test("waitForBackend polls until healthy", async () => {
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    if (calls < 3) throw new Error("not yet");
    return { ok: true, json: async () => ({ status: "ok" }) };
  };
  const healthy = await backend.waitForBackend("http://x", {
    timeoutMs: 2000,
    intervalMs: 5,
    fetchImpl: flaky,
  });
  assert.equal(healthy, true);
  assert.ok(calls >= 3);
});

test("waitForBackend times out when never healthy", async () => {
  const never = async () => {
    throw new Error("refused");
  };
  const healthy = await backend.waitForBackend("http://x", {
    timeoutMs: 60,
    intervalMs: 20,
    fetchImpl: never,
  });
  assert.equal(healthy, false);
});
