"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("creatorScreen", {
  isElectron: true,
  setCapturePurpose: (purpose) => ipcRenderer.send("capture:set-purpose", purpose),
  onPickerRequest: (cb) => {
    const listener = (_event, sources) => cb(sources);
    ipcRenderer.on("picker:request", listener);
    return () => ipcRenderer.removeListener("picker:request", listener);
  },
  selectSource: (id) => ipcRenderer.send("picker:select", id),
  saveRecording: (data, fileName) =>
    ipcRenderer.invoke("recording:save", { data, fileName }),
});
