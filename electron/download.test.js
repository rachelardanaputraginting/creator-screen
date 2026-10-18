"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createDownloadHandler } = require("./download");

function fakeItem(filename) {
  const calls = { savePath: null, cancelled: 0 };
  return {
    item: {
      getFilename: () => filename,
      setSavePath: (p) => {
        calls.savePath = p;
      },
      cancel: () => {
        calls.cancelled += 1;
      },
    },
    calls,
  };
}

test("saves to the chosen path", () => {
  const { item, calls } = fakeItem("recording.webm");
  const handler = createDownloadHandler({ showSaveDialog: () => "C:/out/recording.webm" });
  handler(item);
  assert.equal(calls.savePath, "C:/out/recording.webm");
  assert.equal(calls.cancelled, 0);
});

test("cancels when the dialog is dismissed", () => {
  const { item, calls } = fakeItem("recording.webm");
  const handler = createDownloadHandler({ showSaveDialog: () => undefined });
  handler(item);
  assert.equal(calls.savePath, null);
  assert.equal(calls.cancelled, 1);
});

test("offers the download's own filename as the default", () => {
  let seen = null;
  const { item } = fakeItem("my-recording.webm");
  const handler = createDownloadHandler({
    showSaveDialog: (name) => {
      seen = name;
      return "C:/x.webm";
    },
  });
  handler(item);
  assert.equal(seen, "my-recording.webm");
});
