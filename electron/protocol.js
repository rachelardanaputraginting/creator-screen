"use strict";
const path = require("node:path");

/**
 * Map a pathname from the app:// scheme to an absolute file path inside outDir.
 * Returns null when the input is invalid or escapes outDir.
 */
function resolveAppPath(pathname, outDir) {
  if (typeof pathname !== "string") return null;

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const segments = decoded.split(/[\\/]+/).filter(Boolean);
  if (segments.some((s) => s === "..")) return null;

  const rel = segments.length === 0 ? "index.html" : segments.join("/");
  const resolved = path.join(outDir, rel);

  const root = path.resolve(outDir);
  const relToRoot = path.relative(root, resolved);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) return null;

  return resolved;
}

module.exports = { resolveAppPath };
