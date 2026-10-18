"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { isPermissionAllowed } = require("./permissions");

test("media is allowed so camera and microphone work", () => {
  assert.equal(isPermissionAllowed("media"), true);
});

test("fullscreen is allowed so the recorder can go fullscreen", () => {
  assert.equal(isPermissionAllowed("fullscreen"), true);
});

test("other permissions are denied", () => {
  const denied = [
    "geolocation",
    "notifications",
    "openExternal",
    "clipboard-read",
    "midi",
    "pointerLock",
    "idle-detection",
  ];
  for (const p of denied) {
    assert.equal(isPermissionAllowed(p), false, p + " must be denied");
  }
});

test("unknown and empty permissions are denied", () => {
  assert.equal(isPermissionAllowed(undefined), false);
  assert.equal(isPermissionAllowed(""), false);
});
