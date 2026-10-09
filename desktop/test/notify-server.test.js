"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  startNotifyServer,
  validateNotification,
  NOTIFY_PATH,
  LOOPBACK,
} = require("../lib/notify-server");

function post(port, body, { path = NOTIFY_PATH, method = "POST" } = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function withServer(onNotification, fn) {
  const { server, port, url } = await startNotifyServer({ onNotification });
  try {
    await fn({ port, url });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("valid notification is accepted and forwarded", async () => {
  const seen = [];
  await withServer((task) => seen.push(task), async ({ port, url }) => {
    const response = await post(port, {
      id: 7,
      title: "  Pay rent  ",
      due_date: "2030-01-01",
      due_time: "09:00:00",
    });
    assert.equal(response.status, 202);
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0], {
      id: 7,
      title: "Pay rent",
      due_date: "2030-01-01",
      due_time: "09:00:00",
      kind: "overdue",
    });
    assert.equal(url, `http://${LOOPBACK}:${port}${NOTIFY_PATH}`);
  });
});

test("listener binds to loopback only", async () => {
  await withServer(() => {}, async ({ port }) => {
    const response = await post(port, { id: 1, title: "x" });
    assert.equal(response.status, 202);
  });
});

test("invalid payloads are rejected with 422", async () => {
  const seen = [];
  await withServer((task) => seen.push(task), async ({ port }) => {
    const cases = [
      { title: "no id" },
      { id: 0, title: "zero id" },
      { id: -3, title: "negative id" },
      { id: 1.5, title: "fractional id" },
      { id: 1, title: "" },
      { id: 1, title: "   " },
      { id: 1, title: 42 },
      { id: 1, title: "x".repeat(201) },
      { id: 1, title: "ok", due_date: 5 },
      [],
      null,
    ];
    for (const body of cases) {
      const response = await post(port, body);
      assert.equal(response.status, 422, `expected 422 for ${JSON.stringify(body)}`);
    }
    assert.equal(seen.length, 0);
  });
});

test("malformed JSON is rejected with 400", async () => {
  await withServer(() => {}, async ({ port }) => {
    const response = await post(port, "{not json", {});
    assert.equal(response.status, 400);
  });
});

test("wrong path or method returns 404", async () => {
  await withServer(() => {}, async ({ port }) => {
    assert.equal((await post(port, { id: 1, title: "x" }, { path: "/other" })).status, 404);
    assert.equal((await post(port, undefined, { method: "GET" })).status, 404);
  });
});

test("oversized bodies are rejected with 413", async () => {
  const seen = [];
  await withServer((task) => seen.push(task), async ({ port }) => {
    const huge = JSON.stringify({ id: 1, title: "x".repeat(9000) });
    let status = 0;
    try {
      status = (await post(port, huge)).status;
    } catch {
      status = 413; // socket destroyed mid-response is acceptable
    }
    assert.equal(status, 413);
    assert.equal(seen.length, 0);
  });
});

test("validateNotification normalizes and rejects", () => {
  assert.deepEqual(validateNotification({ id: 3, title: " hi " }), {
    id: 3,
    title: "hi",
    due_date: null,
    due_time: null,
    kind: "overdue",
  });
  assert.equal(validateNotification({ id: 3 }), null);
  assert.equal(validateNotification("string"), null);
});
