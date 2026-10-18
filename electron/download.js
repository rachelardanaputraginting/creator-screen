"use strict";

/**
 * Build the will-download handler: ask where to save, then set or cancel.
 * `showSaveDialog` is injected so the decision logic is unit-testable.
 */
function createDownloadHandler({ showSaveDialog }) {
  return (item) => {
    const savePath = showSaveDialog(item.getFilename());
    if (!savePath) {
      item.cancel();
      return;
    }
    item.setSavePath(savePath);
  };
}

module.exports = { createDownloadHandler };
