"use strict";

/**
 * In-memory duplicate guard for desktop notifications.
 *
 * The backend already dedupes reminders via the persisted reminder interval
 * (`last_notified_at`), so this guard only protects against double delivery at
 * the Electron boundary (e.g. a retry that arrives moments after a successful
 * one). It is intentionally small and dependency-free so it can be tested.
 */

const DEFAULT_COOLDOWN_MS = 5000;
const DEFAULT_MAX_ENTRIES = 1000;

function createNotificationQueue({
  cooldownMs = DEFAULT_COOLDOWN_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
} = {}) {
  /** @type {Map<number, number>} task id -> timestamp of last shown notification */
  const lastShown = new Map();

  function prune(now) {
    if (lastShown.size <= maxEntries) return;
    for (const [id, ts] of lastShown) {
      if (now - ts >= cooldownMs) lastShown.delete(id);
      if (lastShown.size <= maxEntries) break;
    }
  }

  return {
    /**
     * @returns {boolean} true when a notification for this task should be shown.
     */
    shouldShow(taskId, now = Date.now()) {
      if (!Number.isInteger(taskId)) return false;
      const previous = lastShown.get(taskId);
      if (previous !== undefined && now - previous < cooldownMs) {
        return false;
      }
      lastShown.set(taskId, now);
      prune(now);
      return true;
    },

    /** Test/introspection helper. */
    size() {
      return lastShown.size;
    },
  };
}

module.exports = { createNotificationQueue, DEFAULT_COOLDOWN_MS };
