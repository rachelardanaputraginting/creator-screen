"use strict";
const path = require("node:path");

const DEFAULT_NAME = "creator-screen.mp4";

/** Keep only the file name, so a renderer payload can never choose a folder. */
function safeFileName(fileName) {
  const raw = typeof fileName === "string" ? fileName : "";
  const base = path.basename(raw.replace(/\\/g, "/")).trim();
  return base.length > 0 ? base : DEFAULT_NAME;
}

function toBytes(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return Buffer.alloc(0);
}

/**
 * Build the recording saver: ask where to save, then write the bytes the
 * renderer sent. Both collaborators are injected so the decision logic is
 * unit-testable.
 *
 * Saving deliberately bypasses Chromium's downloader: a download first writes
 * `<uuid>.tmp` into the user's Downloads folder and only becomes the chosen
 * file once the save is applied, so a cancelled or unanswered dialog leaves a
 * stray `.tmp` and no recording.
 */
function createRecordingSaver({ showSaveDialog, writeFile }) {
  return async ({ data, fileName } = {}) => {
    const savePath = await showSaveDialog(safeFileName(fileName));
    if (!savePath) return { saved: false, canceled: true };
    await writeFile(savePath, toBytes(data));
    return { saved: true, path: savePath };
  };
}

module.exports = { createRecordingSaver, safeFileName };
