"use strict";

/**
 * Routes getDisplayMedia requests.
 * - purpose 'record'  → this app's own window (self-capture)
 * - purpose 'preview' → the renderer's source picker
 * The purpose is one-shot and resets to 'preview' after each request.
 */
function createCaptureController({ getSources, requestPicker, getSelfMediaSourceId }) {
  let pendingPurpose = "preview";

  return {
    setPurpose(purpose) {
      if (purpose === "record" || purpose === "preview") pendingPurpose = purpose;
    },
    async handle(request, callback) {
      const purpose = pendingPurpose;
      pendingPurpose = "preview";

      const audio = request && request.audioRequested ? "loopback" : undefined;

      let sources;
      try {
        sources = await getSources();
      } catch {
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

      const chosen = await requestPicker(sources);
      callback(chosen ? { video: chosen, audio } : {});
    },
  };
}

module.exports = { createCaptureController };
