"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createNotificationQueue } = require("../lib/notifier-queue");

test("shows the first notification for a task", () => {
  const queue = createNotificationQueue({ cooldownMs: 1000 });
  assert.equal(queue.shouldShow(1, 1000), true);
});

test("suppresses a duplicate within the cooldown window", () => {
  const queue = createNotificationQueue({ cooldownMs: 1000 });
  assert.equal(queue.shouldShow(1, 1000), true);
  assert.equal(queue.shouldShow(1, 1000), false);
  assert.equal(queue.shouldShow(1, 1999), false);
});

test("allows a new notification once the cooldown elapses", () => {
  const queue = createNotificationQueue({ cooldownMs: 1000 });
  assert.equal(queue.shouldShow(1, 1000), true);
  assert.equal(queue.shouldShow(1, 2000), true);
});

test("tracks tasks independently", () => {
  const queue = createNotificationQueue({ cooldownMs: 1000 });
  assert.equal(queue.shouldShow(1, 1000), true);
  assert.equal(queue.shouldShow(2, 1000), true);
  assert.equal(queue.shouldShow(1, 1001), false);
  assert.equal(queue.shouldShow(2, 1001), false);
});

test("rejects non-integer task ids", () => {
  const queue = createNotificationQueue();
  assert.equal(queue.shouldShow("1"), false);
  assert.equal(queue.shouldShow(1.2), false);
  assert.equal(queue.shouldShow(undefined), false);
});

test("bounds the internal map size", () => {
  const queue = createNotificationQueue({ cooldownMs: 0, maxEntries: 10 });
  for (let i = 1; i <= 50; i++) {
    assert.equal(queue.shouldShow(i, i), true);
  }
  assert.ok(queue.size() <= 11, `expected bounded size, got ${queue.size()}`);
});
