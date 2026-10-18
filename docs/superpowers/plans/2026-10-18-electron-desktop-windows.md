# Electron Desktop (Windows) — Implementation Plan

- Date: 2026-10-18
- Spec: `docs/superpowers/specs/2026-10-18-electron-desktop-windows-design.md`
- Branch: `feat/content-recording-marquee`

## Goal

Run Creator Screen as a Windows Electron window, with screen sharing, camera/mic
and recording-to-disk working, while leaving browser mode unchanged.

## Architecture

- Next.js app is exported statically (`output: 'export'` → `out/`) and served to
  the renderer over a privileged `app://` scheme.
- `electron/main.js` owns the window, protocol, permissions, capture routing and
  download saving. Pure logic lives in small, unit-tested modules that do **not**
  import `electron`.
- `electron/preload.js` bridges a tiny, safe API to the renderer as
  `window.creatorScreen`.
- The renderer only adds guards/calls behind `window.creatorScreen`, so a normal
  browser never sees different behavior.

## Tech stack

- Electron `44.9.0` (dev dependency), Node `22.12.0` (built-in `node:test`).
- `concurrently` + `wait-on` (dev) for the one-command dev script.
- Next 16.3.6, React 19.2.8 (unchanged).

## File structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `next.config.ts` | modify | `output: 'export'`, `images.unoptimized` |
| `electron/protocol.js` | create | `app://` pathname → safe absolute file path |
| `electron/protocol.test.js` | create | unit tests for the above |
| `electron/sources.js` | create | serialize `desktopCapturer` sources |
| `electron/sources.test.js` | create | unit tests for the above |
| `electron/capture.js` | create | purpose state + display-media selection |
| `electron/capture.test.js` | create | unit tests for the above |
| `electron/preload.js` | create | `contextBridge` API |
| `electron/main.js` | create | window, protocol, permissions, IPC, download |
| `components/capture-source-picker.tsx` | create | shadcn Dialog to pick a capture source |
| `types/electron.d.ts` | create | `window.creatorScreen` typings |
| `app/hooks/use-stage-recorder.ts` | modify | set purpose `record`, relax surface check |
| `app/components/editor-layout.tsx` | modify | set purpose `preview`, mount picker |
| `package.json` | modify | electron dep, `test` / `electron:*` scripts |
| `eslint.config.mjs` | modify | ignore `electron/**` |

---

## Task 1 — Enable Next static export

**Files:** modify `next.config.ts`

**Step 1 — edit**

`next.config.ts` becomes:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
```

(Preserve any existing keys already in the file; add these two.)

**Step 2 — verify the export**

```bash
pnpm build
ls out/index.html out/_next
```

Expected: build succeeds and `out/index.html` exists.

**Step 3 — commit**

```bash
git add next.config.ts
git commit -m "build: enable next static export for the desktop shell"
```

---

## Task 2 — `electron/protocol.js` (test-first)

**Files:** create `electron/protocol.test.js`, `electron/protocol.js`; modify `package.json`

**Step 1 — add the test script** in `package.json` `"scripts"`:

```json
"test": "node --test electron"
```

**Step 2 — write the failing test** `electron/protocol.test.js`:

```js
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
```

**Step 3 — run, expect failure**

```bash
pnpm test
```

Expected: `Cannot find module './protocol'`.

**Step 4 — implement** `electron/protocol.js`:

```js
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
```

**Step 5 — run, expect pass**

```bash
pnpm test
```

Expected: 7 passing.

**Step 6 — commit**

```bash
git add package.json electron/protocol.js electron/protocol.test.js
git commit -m "feat(electron): app:// path resolver with unit tests"
```

---

## Task 3 — `electron/sources.js` (test-first)

**Files:** create `electron/sources.test.js`, `electron/sources.js`

**Step 1 — write the failing test** `electron/sources.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { serializeSource, pickSelfSource } = require("./sources");

const toDataUrl = (thumb) => `data:image/png;base64,${thumb}`;

test("screen id gives kind 'screen'", () => {
  const out = serializeSource({ id: "screen:0:0", name: "Display 1", thumbnail: "AAA" }, toDataUrl);
  assert.deepEqual(out, {
    id: "screen:0:0",
    name: "Display 1",
    kind: "screen",
    thumbnail: "data:image/png;base64,AAA",
  });
});

test("window id gives kind 'window'", () => {
  assert.equal(serializeSource({ id: "window:5:0", name: "Editor" }, toDataUrl).kind, "window");
});

test("missing thumbnail serializes to null", () => {
  assert.equal(serializeSource({ id: "window:1:0", name: "E" }, toDataUrl).thumbnail, null);
});

test("pickSelfSource finds the matching id", () => {
  const sources = [{ id: "screen:0:0" }, { id: "window:7:0" }];
  assert.deepEqual(pickSelfSource(sources, "window:7:0"), { id: "window:7:0" });
});

test("pickSelfSource returns null when absent", () => {
  assert.equal(pickSelfSource([{ id: "screen:0:0" }], "window:9:0"), null);
});
```

**Step 2 — run, expect failure**

```bash
pnpm test
```

Expected: `Cannot find module './sources'`.

**Step 3 — implement** `electron/sources.js`:

```js
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

/** Find this app's own window among the sources. */
function pickSelfSource(sources, selfMediaSourceId) {
  return sources.find((s) => s.id === selfMediaSourceId) || null;
}

module.exports = { sourceKind, serializeSource, pickSelfSource };
```

**Step 4 — run, expect pass**

```bash
pnpm test
```

Expected: all tests pass.

**Step 5 — commit**

```bash
git add electron/sources.js electron/sources.test.js
git commit -m "feat(electron): desktopCapturer source serialization"
```

---

## Task 4 — `electron/capture.js` (test-first)

**Files:** create `electron/capture.test.js`, `electron/capture.js`

**Step 1 — write the failing test** `electron/capture.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createCaptureController } = require("./capture");

const SOURCES = [{ id: "screen:0:0", name: "Display" }, { id: "window:7:0", name: "Creator" }];

function make(opts = {}) {
  const calls = { picked: [] };
  const controller = createCaptureController({
    getSources: opts.getSources || (async () => SOURCES),
    requestPicker: opts.requestPicker || (async (s) => { calls.picked.push(s); return s[0]; }),
    getSelfMediaSourceId: opts.getSelfMediaSourceId || (() => "window:7:0"),
  });
  return { controller, calls };
}

test("record purpose returns this app's own window", async () => {
  const { controller } = make();
  controller.setPurpose("record");
  const result = await new Promise((res) => controller.handle({ audioRequested: false }, res));
  assert.equal(result.video.id, "window:7:0");
  assert.equal(result.audio, undefined);
});

test("record purpose shares loopback audio when requested", async () => {
  const { controller } = make();
  controller.setPurpose("record");
  const result = await new Promise((res) => controller.handle({ audioRequested: true }, res));
  assert.equal(result.audio, "loopback");
});

test("preview purpose goes through the picker", async () => {
  const { controller, calls } = make();
  controller.setPurpose("preview");
  const result = await new Promise((res) => controller.handle({}, res));
  assert.equal(result.video.id, "screen:0:0");
  assert.equal(calls.picked.length, 1);
});

test("purpose defaults to preview", async () => {
  const { controller, calls } = make();
  await new Promise((res) => controller.handle({}, res));
  assert.equal(calls.picked.length, 1);
});

test("purpose resets after a record call", async () => {
  const { controller, calls } = make();
  controller.setPurpose("record");
  await new Promise((res) => controller.handle({}, res));
  await new Promise((res) => controller.handle({}, res));
  assert.equal(calls.picked.length, 1); // second call used the picker
});

test("no sources denies the request", async () => {
  const { controller } = make({ getSources: async () => [] });
  controller.setPurpose("record");
  assert.deepEqual(await new Promise((res) => controller.handle({}, res)), {});
});

test("self window missing denies the record request", async () => {
  const { controller } = make({ getSelfMediaSourceId: () => "window:999:0" });
  controller.setPurpose("record");
  assert.deepEqual(await new Promise((res) => controller.handle({}, res)), {});
});
```

**Step 2 — run, expect failure**

```bash
pnpm test
```

Expected: `Cannot find module './capture'`.

**Step 3 — implement** `electron/capture.js`:

```js
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
```

**Step 4 — run, expect pass**

```bash
pnpm test
```

Expected: all tests pass.

**Step 5 — commit**

```bash
git add electron/capture.js electron/capture.test.js
git commit -m "feat(electron): display-media capture routing"
```

---

## Task 5 — Electron main process + preload + scripts

**Files:** create `electron/preload.js`, `electron/main.js`; modify `package.json`, `eslint.config.mjs`

**Step 1 — install deps**

```bash
pnpm add -D electron@44.9.0 concurrently wait-on
```

**Step 2 — add scripts** to `package.json`:

```json
"electron:dev": "concurrently -k \"next dev -p 3001\" \"wait-on tcp:127.0.0.1:3001 && electron .\"",
"electron:start": "electron . --prod"
```

**Step 3 — ignore the Electron sources in ESLint**

Add `"electron/**"` to the `ignores` array of `eslint.config.mjs` (create the array
entry if it does not exist). This keeps `pnpm lint` from judging Node CommonJS
files with the Next/React ruleset.

**Step 4 — create `electron/preload.js`**:

```js
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("creatorScreen", {
  isElectron: true,
  setCapturePurpose: (purpose) => ipcRenderer.send("capture:set-purpose", purpose),
  listSources: () => ipcRenderer.invoke("capture:list-sources"),
  onPickerRequest: (cb) => {
    const listener = (_event, sources) => cb(sources);
    ipcRenderer.on("picker:request", listener);
    return () => ipcRenderer.removeListener("picker:request", listener);
  },
  selectSource: (id) => ipcRenderer.send("picker:select", id),
});
```

**Step 5 — create `electron/main.js`**:

```js
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

const OUT_DIR = path.join(__dirname, "..", "out");
const DEV_URL = "http://localhost:3001";
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
    desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 320, height: 180 } }),
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

  ses.on("will-download", (_event, item) => {
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      defaultPath: item.getFilename(),
    });
    if (!savePath) {
      item.cancel();
      return;
    }
    item.setSavePath(savePath);
  });
}

function registerIpc() {
  ipcMain.on("capture:set-purpose", (_event, purpose) => captureController.setPurpose(purpose));
  ipcMain.on("picker:select", (_event, id) => {
    if (pendingPicker) {
      const resolve = pendingPicker;
      pendingPicker = null;
      resolve(id);
    }
  });
  ipcMain.handle("capture:list-sources", async () =>
    (await desktopCapturer.getSources({ types: ["screen", "window"] })).map(toPickerSource),
  );
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
```

**Step 6 — verify it launches** (dev server on :3001 is started by the script)

```bash
pnpm electron:dev
```

Expected: a desktop window opens showing the app in dark theme; DevTools console
(open with Ctrl+Shift+I) shows no errors.

**Step 7 — commit**

```bash
git add package.json pnpm-lock.yaml eslint.config.mjs electron/main.js electron/preload.js
git commit -m "feat(electron): main process, preload bridge and dev scripts"
```

---

## Task 6 — Renderer integration

**Files:** create `types/electron.d.ts`, `components/capture-source-picker.tsx`; modify `app/hooks/use-stage-recorder.ts`, `app/components/editor-layout.tsx`

**Step 1 — write `types/electron.d.ts`**:

```ts
export type CapturePurpose = "record" | "preview";

export interface CaptureSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string | null;
}

export interface CreatorScreenBridge {
  isElectron: boolean;
  setCapturePurpose: (purpose: CapturePurpose) => void;
  listSources: () => Promise<CaptureSource[]>;
  onPickerRequest: (cb: (sources: CaptureSource[]) => void) => () => void;
  selectSource: (id: string) => void;
}

declare global {
  interface Window {
    creatorScreen?: CreatorScreenBridge;
  }
}
```

**Step 2 — create `components/capture-source-picker.tsx`**:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CaptureSource } from "@/types/electron";

export function CaptureSourcePicker() {
  const [sources, setSources] = useState<CaptureSource[] | null>(null);

  useEffect(() => {
    const bridge = window.creatorScreen;
    if (!bridge) return;
    return bridge.onPickerRequest((next) => setSources(next));
  }, []);

  const bridge = typeof window === "undefined" ? undefined : window.creatorScreen;
  if (!bridge || !sources) return null;

  const choose = (id: string) => {
    bridge.selectSource(id);
    setSources(null);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && choose("")}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pilih sumber layar</DialogTitle>
          <DialogDescription>
            Pilih layar atau jendela yang ingin dibagikan.
          </DialogDescription>
        </DialogHeader>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada sumber yang tersedia.</p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {sources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => choose(source.id)}
                className="flex flex-col gap-2 rounded-md border border-border p-2 text-left hover:bg-accent"
              >
                {source.thumbnail ? (
                  <img src={source.thumbnail} alt={source.name} className="aspect-video w-full rounded object-cover" />
                ) : (
                  <div className="aspect-video w-full rounded bg-muted" />
                )}
                <span className="truncate text-xs text-foreground">{source.name}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3 — modify `app/hooks/use-stage-recorder.ts`**

Right before the `navigator.mediaDevices.getDisplayMedia({ ... })` call, add:

```ts
window.creatorScreen?.setCapturePurpose("record");
```

Then relax the surface check. Replace the block that rejects when
`track.getSettings().displaySurface !== "browser"` with a version that also
accepts Electron self-capture:

```ts
const surface = track.getSettings().displaySurface;
if (!window.creatorScreen?.isElectron && surface !== "browser") {
  // keep the existing error + cleanup for browser mode
}
```

**Step 4 — modify `app/components/editor-layout.tsx`**

Immediately before the `navigator.mediaDevices.getDisplayMedia({ ... })` call
(near line 420), add:

```ts
window.creatorScreen?.setCapturePurpose("preview");
```

And render the picker once inside the editor shell's root JSX:

```tsx
import { CaptureSourcePicker } from "@/components/capture-source-picker";
// ...
<CaptureSourcePicker />
```

**Step 5 — verify types and lint for touched files**

```bash
npx tsc --noEmit
pnpm lint
```

Expected: `tsc` exits 0; no new lint errors in the touched files.

**Step 6 — verify browser mode unchanged**

```bash
pnpm dev
```

Open `http://localhost:3000`, click "Share screen": the browser's own picker must
still appear (the bridge is absent, so nothing changes).

**Step 7 — commit**

```bash
git add types/electron.d.ts components/capture-source-picker.tsx app/hooks/use-stage-recorder.ts app/components/editor-layout.tsx
git commit -m "feat(electron): wire capture purpose, source picker and bridge typings"
```

---

## Task 7 — Recording saved to disk

This is already handled by the `will-download` handler in Task 5; here we verify it.

**Step 1 — verify**

1. `pnpm electron:dev`
2. Click "Record HD", let it run a few seconds, stop it.
3. The app triggers a download → a native Save dialog appears.
4. Save it, then confirm the file exists in Explorer and plays.

**Step 2 — verify cancel path**

Repeat and press Cancel in the dialog: no file is written and no error appears.

**Step 3 — commit** (only if adjustments were needed)

```bash
git add electron/main.js
git commit -m "fix(electron): recording download handling"
```

---

## Task 8 — End-to-end verification

**Step 1 — production build**

```bash
pnpm build
pnpm electron:start
```

Expected: the window loads from `app://bundle/index.html` with no errors.

**Step 2 — screenshot parity**

Screenshot the Electron window and the browser version; they must look identical
(dark theme, same fonts, same layout).

**Step 3 — functional checklist**

- [ ] Share screen → picker → chosen screen appears on the stage
- [ ] Camera source works
- [ ] Microphone level meter moves
- [ ] Record HD → Save dialog → file written and playable
- [ ] DevTools console clean
- [ ] `pnpm dev` in a browser still behaves exactly as before

**Step 4 — commit** any residual fixes.

---

## Review Focus

Failure modes this spec implies that have no dedicated task above — verify each:

1. **Unknown `app://` path** (e.g. `app://bundle/missing.js`) returns a 404
   instead of hanging or serving `index.html`.
2. **Path traversal** (`app://bundle/../../etc`) cannot escape `out/`
   (covered by Task 2 tests, but confirm end-to-end).
3. **Save dialog cancelled** leaves no partial file and no uncaught error.
4. **Stale capture purpose**: a `record` request followed by an unrelated
   `getDisplayMedia` must not reuse `record` (covered by Task 4 tests).
5. **Permission denied** for camera/mic makes the app show its own existing
   error message rather than hanging on a pending promise.
