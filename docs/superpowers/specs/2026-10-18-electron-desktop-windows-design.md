# Electron Desktop (Windows) — Design

- Date: 2026-10-18
- Status: Approved (design), pending spec review
- Author: OpenCode + human partner

## 1. Context

Creator Screen is a **Next.js 16 App Router** app (React 19, Tailwind CSS v4,
shadcn/ui on Base UI) with a dark-first editor UI. It is currently run in a
browser via `next dev` / `next start`.

`PRD.md` §8 specifies a desktop application with a **preferred Tauri** runtime
and **Electron as the documented alternative**, and §52 prioritizes Windows
desktop support.

Environment facts:

- Rust/Cargo toolchain is **not installed** on the build machine (required by Tauri).
- Node `v22.12.0` + pnpm `10.6.3` are available; Chrome/Edge present.
- All application components are Client Components (`"use client"`); there are
  no route handlers, server actions, `next/link`, or `useRouter` usages in
  `app/`. Static export is therefore viable.

### Decision

Use **Electron** for the first Windows desktop version.

Rationale: Electron runs on the existing Node toolchain (no Rust/MSVC install),
renders with bundled Chromium (visually identical to the current browser
rendering), and ships quickly. Tauri remains a future option and this design
keeps the split (web app vs. desktop shell) so the runtime could be swapped.

## 2. Goal and success criteria

Success criteria:

1. Creator Screen runs as a Windows desktop window via Electron.
2. The UI is visually identical to the browser version (same shadcn/Tailwind output).
3. Screen sharing (`navigator.mediaDevices.getDisplayMedia`) works.
4. Camera and microphone (`getUserMedia`) work with permissions granted.
5. "Record HD" produces a recording that is **saved to disk**.
6. No console errors during normal use.

## 3. Non-goals (this version)

- Installer (`.exe` / `.msi`), app icon, code signing, auto-update.
- Frameless window / custom title bar.
- New capture features beyond what the app already requests.
- macOS / Linux packaging.

## 4. Key decisions

| # | Decision | Alternatives considered | Why |
|---|----------|-------------------------|-----|
| D1 | Serve the app via Next `output: 'export'` → `out/`, exposed on a custom `app://` scheme using `protocol.handle`. | (a) child process running `next start`; (b) loading `file://out/index.html` directly. | (a) bundles Node + `.next` and is far heavier. (b) breaks absolute `/_next/...` asset paths and client routing. `app://` is the Electron-recommended way to serve local static files. |
| D2 | Screen capture through `session.setDisplayMediaRequestHandler` + `desktopCapturer`. | Legacy `getUserMedia` with `chromeMediaSource: 'desktop'`. | `setDisplayMediaRequestHandler` is the current, supported API; the legacy approach is deprecated. |
| D3 | Renderer security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, bridge via `contextBridge` in a preload script. | Enable node integration. | Keeps the web app untrusted-surface-safe and matches Electron best practice. |
| D4 | Dev uses `next dev` on `localhost:3001`; production uses `app://`. | Always use the built output in dev. | Preserves HMR during development. |

## 5. Architecture

```
┌───────────────────────────── Electron main (Node) ─────────────────────────────┐
│  main.js                                                                       │
│   • createWindow()            BrowserWindow (contextIsolation, sandbox)        │
│   • registerAppProtocol()     protocol.handle('app', serve out/)               │
│   • setPermissionRequestHandler   allow: media (camera, microphone)            │
│   • setDisplayMediaRequestHandler desktopCapturer.getSources + purpose hint    │
│   • ipcMain handlers          'capture:set-purpose', 'picker:select',          │
│                               'capture:list-sources'                           │
│   • will-download             dialog.showSaveDialog → save recording           │
└───────────────────────────────────────┬────────────────────────────────────────┘
                                        │ contextBridge (preload.js)
                                        ▼
┌──────────────────────────── Renderer (Next app in Chromium) ───────────────────┐
│  window.creatorScreen = { isElectron, setCapturePurpose, listSources,          │
│                           onPickerRequest, selectSource }                      │
│                                                                                │
│  app/hooks/use-stage-recorder.ts   → setCapturePurpose('record') then          │
│                                       getDisplayMedia({ audio:false, ... })    │
│  app/components/editor-layout.tsx  → setCapturePurpose('preview') then         │
│                                       getDisplayMedia({ ... })                 │
│  components/capture-source-picker.tsx  → shadcn Dialog shown for 'preview'     │
└────────────────────────────────────────────────────────────────────────────────┘
```

## 6. Components

### 6.1 `electron/main.js`

- `createWindow()`: `BrowserWindow` with `webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true }`.
- `registerAppProtocol()`: `protocol.handle('app', (request) => …)` maps `app://…` to files under `out/`, defaulting `/` to `index.html`.
- `setPermissionRequestHandler`: allow `media` permission requests for `camera`/`microphone`; deny everything else.
- `setDisplayMediaRequestHandler(request, callback)`:
  1. Read the pending capture purpose set via IPC (`'record'` | `'preview'`, default `'preview'`).
  2. `desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize })`.
  3. If purpose is `'record'` → return this app's own window source (self-capture).
     If purpose is `'preview'` → ask the renderer to pick (send `picker:request` with
     sources, await `picker:select`) and return the chosen source.
  4. `callback({ video: source, audio: request.audioRequested ? 'loopback' : undefined })`,
     so system audio is shared only when the app asks for it.
- `ipcMain.handle('capture:list-sources')`: returns serializable source list (`id`, `name`, `thumbnail` data URL).
- `ipcMain.on('capture:set-purpose')`: stores the one-shot purpose.
- `ipcMain.on('picker:select')`: resolves the pending picker promise.
- `session.on('will-download')`: intercept, show `dialog.showSaveDialog`, and write the file.

### 6.2 `electron/preload.js`

`contextBridge.exposeInMainWorld('creatorScreen', { … })`:

- `isElectron: true`
- `setCapturePurpose(purpose)`
- `listSources()`
- `onPickerRequest(cb)` / `selectSource(id)`

No Node API is exposed to the renderer.

### 6.3 `next.config.ts`

Add:

```ts
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};
```

### 6.4 `components/capture-source-picker.tsx` (new)

A Client Component rendering a shadcn `Dialog` that lists screens and windows
with thumbnails. Subscribes to `creatorScreen.onPickerRequest`, and on choose
calls `creatorScreen.selectSource(id)`. Rendered by the editor shell so it is
always mounted while the app is running.

### 6.5 Renderer edits (minimal)

- `app/hooks/use-stage-recorder.ts`:
  - Before `getDisplayMedia`, call `creatorScreen.setCapturePurpose('record')`.
  - In Electron, skip the `track.getSettings().displaySurface !== "browser"`
    rejection (self-capture is a window, not a browser tab).
- `app/components/editor-layout.tsx`:
  - Before `getDisplayMedia`, call `creatorScreen.setCapturePurpose('preview')`.
- Both call sites guard on `window.creatorScreen` so **browser behavior is unchanged**
  when the same code runs in a normal browser.

### 6.6 `package.json`

Add `electron` as a dev dependency and scripts:

- `"electron:dev"`: run `next dev` and launch Electron pointed at `http://localhost:3001`.
- `"electron:build"`: `next build` (produces `out/`) then launch Electron against `app://`.

## 7. Data flow

**Preview / "Share screen"**

```
user clicks Share screen
  → renderer: window.creatorScreen.setCapturePurpose('preview')
  → renderer: getDisplayMedia(...)
  → main: setDisplayMediaRequestHandler  → desktopCapturer.getSources
  → main: picker:request → renderer Dialog  → user picks  → picker:select
  → main: callback({ video: source })
  → renderer: receives MediaStream, sets main content source
```

**Record HD (self-capture)**

```
user clicks Record HD
  → renderer: setCapturePurpose('record')
  → renderer: getDisplayMedia(...)
  → main: returns the app's own window source
  → renderer: MediaRecorder composes stage + audio mix
  → on stop: Blob → anchor download
  → main: will-download → showSaveDialog → file written to disk
```

## 8. Build and dev workflow

- **Dev:** `pnpm electron:dev` → `next dev` on :3001, Electron loads `http://localhost:3001`. HMR works.
- **Prod build:** `pnpm electron:build` → `next build` emits `out/`, Electron loads `app://`. No Node server is shipped.

## 9. Error handling

- `getDisplayMedia` failure → keep the app's existing user-facing messages.
- No sources available (permissions blocked) → picker shows an explanatory empty state.
- Download cancelled in the save dialog → no file written, no error surfaced.
- `app://` request for a missing file → respond `404`.

## 10. Testing and verification

1. `npx tsc --noEmit` and `pnpm lint` stay clean for touched files.
2. Launch Electron against the production build; screenshot the window and
   compare with the browser screenshot (must match).
3. Manual checks: Share screen works; camera + mic produce preview; Record HD
   writes a playable file to the chosen path; the DevTools console shows no errors.
4. Confirm browser mode still works unchanged (`pnpm dev` in a browser).

## 11. Risks

- **Self-capture semantics.** The app records its own surface. Electron reports
  `getSettings().displaySurface` differently than a browser, so the check is
  relaxed for Electron; this is guarded to Electron only.
- **Static-export parity.** Any future server-only Next feature would break
  `output: 'export'`. This is documented so it is not adopted by accident.
- **Download flow.** Relying on `will-download` is Chromium-specific behavior;
  verified against a real save cycle.

## 12. Future (out of scope now)

- Tauri migration (keep the web app runtime-agnostic).
- Installer + app icon + code signing.
- Frameless custom title bar.
- Native window list improvements / system picker when Electron supports it on Windows.
