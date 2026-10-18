"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { resolveAppPath } = require("./protocol");

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
