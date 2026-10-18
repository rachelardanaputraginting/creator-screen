"use strict";
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
const { resolveAppPath } = require("./protocol");
const { serializeSource } = require("./sources");
const { createCaptureController } = require("./capture");
const { createDownloadHandler } = require("./download");

const OUT_DIR = path.join(__dirname, "..", "out");
const DEV_URL = "http://localhost:3000";
const useDevServer = !app.isPackaged && !process.argv.includes("--prod");

let mainWindow = null;
let pendingPicker = null;

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol() {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const filePath = resolveAppPath(pathname, OUT_DIR);
    if (!filePath) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
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
    callback(permission === "media");
  });

  ses.setDisplayMediaRequestHandler((request, callback) => {
    captureController.handle(request, callback);
  });

  ses.on("will-download", (_event, item) => handleDownload(item));
}

const handleDownload = createDownloadHandler({
  showSaveDialog: (defaultName) =>
    dialog.showSaveDialogSync(mainWindow, { defaultPath: defaultName }),
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
    mainWindow.loadURL("app://bundle/index.html");
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
