"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { resolveAppPath, createAppProtocolHandler } = require("./protocol");

const OUT = path.resolve("/tmp/out");

test("root maps to index.html", () => {
  assert.equal(resolveAppPath("/", OUT), path.join(OUT, "index.html"));
});

test("empty maps to index.html", () => {
  assert.equal(resolveAppPath("", OUT), path.join(OUT, "index.html"));
});

test("regular asset maps inside out", () => {
  assert.equal(
    resolveAppPath("/_next/static/app.js", OUT),
    path.join(OUT, "_next", "static", "app.js"),
  );
});

test("parent traversal is rejected", () => {
  assert.equal(resolveAppPath("/../../secret", OUT), null);
});

test("encoded traversal is rejected", () => {
  assert.equal(resolveAppPath("/%2e%2e/%2e%2e/secret", OUT), null);
});

test("null byte is rejected", () => {
  assert.equal(resolveAppPath("/a%00b", OUT), null);
});

test("non-string is rejected", () => {
  assert.equal(resolveAppPath(undefined, OUT), null);
});

test("handler serves a resolvable file through fetchFile", async () => {
  const handler = createAppProtocolHandler({
    outDir: OUT,
    fetchFile: async (filePath) => new Response("body:" + filePath, { status: 200 }),
  });
  const res = await handler({ url: "app://bundle/index.html" });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "body:" + path.join(OUT, "index.html"));
});

test("handler returns 404 when the file cannot be read", async () => {
  const handler = createAppProtocolHandler({
    outDir: OUT,
    fetchFile: async () => {
      throw new Error("net::ERR_FILE_NOT_FOUND");
    },
  });
  const res = await handler({ url: "app://bundle/missing.js" });
  assert.equal(res.status, 404);
});

test("handler returns 404 without fetching when the path is rejected", async () => {
  let called = 0;
  const handler = createAppProtocolHandler({
    outDir: OUT,
    fetchFile: async () => {
      called += 1;
      return new Response("x");
    },
  });
  const res = await handler({ url: "app://bundle/a%00b" });
  assert.equal(res.status, 404);
  assert.equal(called, 0);
});
