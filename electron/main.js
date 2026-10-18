"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  dialog,
  desktopCapturer,
  ipcMain,
  net,
  protocol,
  session,
} = require("electron");
const { createAppProtocolHandler } = require("./protocol");
const { serializeSource } = require("./sources");
const { createCaptureController } = require("./capture");
const { isPermissionAllowed } = require("./permissions");
const { createRecordingSaver } = require("./save-recording");

const OUT_DIR = path.join(__dirname, "..", "out");
const DEV_URL = "http://localhost:3000";
const useDevServer = !app.isPackaged && !process.argv.includes("--prod");

let mainWindow = null;
let pendingPicker = null;

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol() {
  protocol.handle(
    "app",
    createAppProtocolHandler({
      outDir: OUT_DIR,
      fetchFile: (filePath) => net.fetch(pathToFileURL(filePath).toString()),
    }),
  );
}

function toPickerSource(source) {
  return serializeSource(source, (image) => image.toDataURL());
}

function requestPicker(sources) {
  return new Promise((resolve) => {
    pendingPicker = (id) => resolve(sources.find((s) => s.id === id) || null);
    if (!mainWindow) {
      pendingPicker = null;
      resolve(null);
      return;
    }
    mainWindow.webContents.send("picker:request", sources.map(toPickerSource));
  });
}

const captureController = createCaptureController({
  getSources: () =>
    desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
    }),
  requestPicker,
  getSelfMediaSourceId: () => (mainWindow ? mainWindow.getMediaSourceId() : ""),
});

function installSessionHandlers() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(isPermissionAllowed(permission));
  });

  ses.setDisplayMediaRequestHandler((request, callback) => {
    captureController.handle(request, callback);
  });
}

/**
 * Ask where to save and write the bytes ourselves. Chromium's downloader is
 * avoided on purpose: it parks `<uuid>.tmp` files in the user's Downloads
 * folder and only renames them once the save is applied, so cancelling the
 * dialog (or missing it while the window is fullscreen) strands the temp file
 * and loses the recording.
 */
const saveRecording = createRecordingSaver({
  showSaveDialog: async (defaultName) => {
    const ext = path.extname(defaultName).slice(1).toLowerCase();
    const options = {
      title: "Simpan rekaman",
      defaultPath: defaultName,
      ...(ext ? { filters: [{ name: "Video", extensions: [ext] }] } : {}),
    };
    const { canceled, filePath } = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);
    return canceled ? undefined : filePath;
  },
  writeFile: (filePath, data) => fs.promises.writeFile(filePath, data),
});

function registerIpc() {
  ipcMain.on("capture:set-purpose", (_event, purpose) => captureController.setPurpose(purpose));
  ipcMain.on("picker:select", (_event, id) => {
    if (pendingPicker) {
      const resolve = pendingPicker;
      pendingPicker = null;
      resolve(id);
    }
  });
  ipcMain.handle("recording:save", (_event, payload) => saveRecording(payload));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (useDevServer) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadURL("app://bundle/app.html");
  }
}

app.whenReady().then(() => {
  registerAppProtocol();
  installSessionHandlers();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
