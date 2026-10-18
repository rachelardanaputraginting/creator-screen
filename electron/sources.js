"use strict";

function sourceKind(id) {
  return String(id).startsWith("screen:") ? "screen" : "window";
}

/** Convert a desktopCapturer source into a plain, IPC-safe object. */
function serializeSource(source, toDataUrl) {
  return {
    id: source.id,
    name: source.name,
    kind: sourceKind(source.id),
    thumbnail: source.thumbnail ? toDataUrl(source.thumbnail) : null,
  };
}

module.exports = { sourceKind, serializeSource };
