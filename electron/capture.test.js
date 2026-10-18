"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createCaptureController } = require("./capture");

const SOURCES = [{ id: "screen:0:0", name: "Display" }, { id: "window:7:0", name: "Creator" }];

function make(opts = {}) {
  const calls = { picked: [] };
  const controller = createCaptureController({
    getSources: opts.getSources || (async () => SOURCES),
    requestPicker:
      opts.requestPicker ||
      (async (s) => {
        calls.picked.push(s);
        return s[0];
      }),
    getSelfMediaSourceId: opts.getSelfMediaSourceId || (() => "window:7:0"),
  });
  return { controller, calls };
}

test("record purpose returns this app's own window", async () => {
  const { controller } = make();
  controller.setPurpose("record");
  const result = await new Promise((res) => controller.handle({ audioRequested: false }, res));
  assert.equal(result.video.id, "window:7:0");
  assert.equal(result.audio, undefined);
});

test("record purpose shares loopback audio when requested", async () => {
  const { controller } = make();
  controller.setPurpose("record");
  const result = await new Promise((res) => controller.handle({ audioRequested: true }, res));
  assert.equal(result.audio, "loopback");
});

test("preview purpose goes through the picker", async () => {
  const { controller, calls } = make();
  controller.setPurpose("preview");
  const result = await new Promise((res) => controller.handle({}, res));
  assert.equal(result.video.id, "screen:0:0");
  assert.equal(calls.picked.length, 1);
});

test("purpose defaults to preview", async () => {
  const { controller, calls } = make();
  await new Promise((res) => controller.handle({}, res));
  assert.equal(calls.picked.length, 1);
});

test("purpose resets after a record call", async () => {
  const { controller, calls } = make();
  controller.setPurpose("record");
  await new Promise((res) => controller.handle({}, res));
  await new Promise((res) => controller.handle({}, res));
  assert.equal(calls.picked.length, 1); // second call used the picker
});

test("no sources denies the request", async () => {
  const { controller } = make({ getSources: async () => [] });
  controller.setPurpose("record");
  assert.deepEqual(await new Promise((res) => controller.handle({}, res)), {});
});

test("self window missing denies the record request", async () => {
  const { controller } = make({ getSelfMediaSourceId: () => "window:999:0" });
  controller.setPurpose("record");
  assert.deepEqual(await new Promise((res) => controller.handle({}, res)), {});
});
