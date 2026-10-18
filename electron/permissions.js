"use strict";

/**
 * Only the permissions this app actually uses are granted. Everything else is
 * denied. "fullscreen" matters: Electron asks for it when the recorder calls
 * requestFullscreen(), and a denial leaves that promise pending forever, which
 * stalls the recording flow before getDisplayMedia is ever reached.
 */
const ALLOWED = new Set(["media", "fullscreen"]);

function isPermissionAllowed(permission) {
  return ALLOWED.has(permission);
}

module.exports = { isPermissionAllowed };
