"use strict";

/**
 * Minimal, explicit preload bridge.
 *
 * Security posture:
 *  - contextIsolation is on and nodeIntegration is off (set in main.js), so the
 *    renderer can only reach the main process through the functions below.
 *  - No filesystem, shell, process, or arbitrary channel access is exposed.
 *  - Every channel name is hard-coded here; the renderer cannot pick channels.
 */

const { contextBridge, ipcRenderer } = require("electron");

const appInfo = () => ipcRenderer.invoke("taskguard:app-info");
const backendStatus = () => ipcRenderer.invoke("taskguard:backend-status");

contextBridge.exposeInMainWorld("taskguard", {
  getAppInfo: appInfo,
  getBackendStatus: backendStatus,
});
