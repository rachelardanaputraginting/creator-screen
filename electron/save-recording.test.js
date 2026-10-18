"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRecordingSaver } = require("./save-recording");

test("writes the bytes to the path the user chose", async () => {
  const writes = [];
  const saver = createRecordingSaver({
    showSaveDialog: async () => "C:/out/recording.mp4",
    writeFile: async (p, data) => writes.push([p, data]),
  });

  const result = await saver({
    data: new Uint8Array([1, 2, 3]),
    fileName: "recording.mp4",
  });

  assert.deepEqual(result, { saved: true, path: "C:/out/recording.mp4" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "C:/out/recording.mp4");
  assert.deepEqual([...writes[0][1]], [1, 2, 3]);
});

test("writes nothing when the user cancels", async () => {
  let written = 0;
  const saver = createRecordingSaver({
    showSaveDialog: async () => undefined,
    writeFile: async () => {
      written += 1;
    },
  });

  const result = await saver({
    data: new Uint8Array([1]),
    fileName: "recording.mp4",
  });

  assert.deepEqual(result, { saved: false, canceled: true });
  assert.equal(written, 0);
});

test("offers the recording's own filename as the dialog default", async () => {
  let seen = null;
  const saver = createRecordingSaver({
    showSaveDialog: async (name) => {
      seen = name;
      return undefined;
    },
    writeFile: async () => {},
  });

  await saver({
    data: new Uint8Array([1]),
    fileName: "creator-screen-20261018-1519.mp4",
  });

  assert.equal(seen, "creator-screen-20261018-1519.mp4");
});

test("never lets the renderer pick the directory", async () => {
  let seen = null;
  const saver = createRecordingSaver({
    showSaveDialog: async (name) => {
      seen = name;
      return undefined;
    },
    writeFile: async () => {},
  });

  await saver({ data: new Uint8Array([1]), fileName: "../../Windows/evil.mp4" });

  assert.equal(seen, "evil.mp4");
});

test("accepts a Buffer payload from IPC", async () => {
  const written = [];
  const saver = createRecordingSaver({
    showSaveDialog: async () => "C:/x.webm",
    writeFile: async (_p, data) => written.push(data),
  });

  await saver({ data: Buffer.from([9, 8, 7]), fileName: "x.webm" });

  assert.deepEqual([...written[0]], [9, 8, 7]);
});

test("falls back to a default name when the renderer sends a blank one", async () => {
  let seen = null;
  const saver = createRecordingSaver({
    showSaveDialog: async (name) => {
      seen = name;
      return undefined;
    },
    writeFile: async () => {},
  });

  await saver({ data: new Uint8Array([1]), fileName: "   " });

  assert.equal(seen, "creator-screen.mp4");
});
