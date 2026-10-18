"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { serializeSource } = require("./sources");

const toDataUrl = (thumb) => `data:image/png;base64,${thumb}`;

test("screen id gives kind 'screen'", () => {
  const out = serializeSource({ id: "screen:0:0", name: "Display 1", thumbnail: "AAA" }, toDataUrl);
  assert.deepEqual(out, {
    id: "screen:0:0",
    name: "Display 1",
    kind: "screen",
    thumbnail: "data:image/png;base64,AAA",
  });
});

test("window id gives kind 'window'", () => {
  assert.equal(serializeSource({ id: "window:5:0", name: "Editor" }, toDataUrl).kind, "window");
});

test("missing thumbnail serializes to null", () => {
  assert.equal(serializeSource({ id: "window:1:0", name: "E" }, toDataUrl).thumbnail, null);
});
