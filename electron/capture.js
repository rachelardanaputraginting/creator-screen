"use strict";

/**
 * Routes getDisplayMedia requests.
 * - purpose 'record'  → this app's own output (self-capture)
 * - purpose 'preview' → the renderer's source picker
 * The purpose is one-shot and resets to 'preview' after each request.
 *
 * Linux/Wayland specifics:
 * - Self-capture via desktopCapturer is impossible (the portal exposes one
 *   anonymous source), so recording captures this app's own frame instead.
 * - The portal dialog has already chosen what to share, so a single returned
 *   source is used directly instead of a second in-app picker.
 * - "loopback" system audio is not implemented on Linux.
 */
function createCaptureController({
  getSources,
  requestPicker,
  getSelfMediaSourceId,
  platform = process.platform,
}) {
  let pendingPurpose = "preview";

  return {
    setPurpose(purpose) {
      if (purpose === "record" || purpose === "preview") pendingPurpose = purpose;
    },
    async handle(request, callback) {
      const purpose = pendingPurpose;
      pendingPurpose = "preview";

      const audioRequested = !!(request && request.audioRequested);
      // System-audio loopback hanya ada di Windows/macOS. Di Linux Chromium
      // tetap menuntut nilai audio yang valid ketika renderer memintanya,
      // jadi umpan balik frame tab sendiri (silent) alih-alih menolak.
      const audio = audioRequested
        ? platform === "linux"
          ? request.frame
          : "loopback"
        : undefined;

      if (purpose === "record" && platform === "linux") {
        callback(request && request.frame ? { video: request.frame } : {});
        return;
      }

      let sources;
      try {
        sources = await getSources();
      } catch (e) {
        console.error("desktopCapturer.getSources failed", e);
        callback({});
        return;
      }
      if (!sources || sources.length === 0) {
        callback({});
        return;
      }

      if (purpose === "record") {
        const self = sources.find((s) => s.id === getSelfMediaSourceId());
        callback(self ? { video: self, audio } : {});
        return;
      }

      if (platform === "linux" && sources.length === 1) {
        callback({ video: sources[0], audio });
        return;
      }

      const chosen = await requestPicker(sources);
      callback(chosen ? { video: chosen, audio } : {});
    },
  };
}

module.exports = { createCaptureController };
