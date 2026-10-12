# Region Capture Stage Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the canvas replica recorder with Region Capture self-tab recording of the Creator Screen stage, with zero canvas code remaining.

**Architecture:** A `stageRef` callback marks one stage container per mode (preview + marquee + sidebar; chrome stays outside); the new `useStageRecorder` hook shares the tab, crops the track to the stage element, and records it with the existing mimeType fallback and download flow; the old composite hook file is deleted.

**Tech Stack:** Next.js 16 + React 19, Tailwind v4 + shadcn/ui, Manrope, Screen Capture API (Region Capture) + MediaRecorder, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-region-capture-stage-recording-design.md`

## Global Constraints

- Manrope font, shadcn/ui tokens and components only, no custom colors, no new npm dependencies.
- Zero canvas code remaining: no `document.createElement("canvas")`, no rAF loop, no draw helpers anywhere in `app/`.
- Toolbar, marquee exclusion reversed: marquee IS inside the stage; header, toolbar, record bar, footer, session badge, End button stay outside the crop.
- Mic stays optional; mic failure at start refuses via the editor `mediaError` path.
- This repo has no test runner and no existing tests; verification is `npm run build` plus the manual checklist and greps from the spec.

## Review Focus

- User picks a window/monitor instead of a tab still ends with a clear error and stopped tracks, never a recording of the wrong surface (covered in Task 2).
- Picker cancelled still returns silently with no error Alert and no state change (covered in Task 2).
- Non-Chromium browser still refuses with the browser message before touching media devices (covered in Task 2).
- `cropTo` failure (wrong tab picked) still stops tracks with a clear error and leaves no recorder running (covered in Task 2).
- Record bar, toolbar, and header never appear in the file while the sidebar does, in both editor and presentation modes (covered in Task 1).

---

### Task 1: Stage containers + record bar relocation

**Files:**
- Modify: `app/components/editor-layout.tsx`
- Test: `npm run build` + manual (no test runner in repo)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `attachStage` callback ref (`(node: HTMLElement | null) => void`, sets shared `stageRef`) and two stage containers (editor + presentation) consumed by Task 2 as the `stageEl` argument.

- [ ] **Step 1: Restructure the editor row so the stage excludes chrome**

Replace the `<div className="flex min-h-[calc(100vh-140px)]">` block internals with: `main` (toolbar div untouched, then `<div ref={attachStage} className="flex min-w-0 flex-1 gap-4">` containing `<div className="flex min-w-0 flex-1 flex-col gap-4">{screenPreview}<TechMarquee /></div>`, `<Separator orientation="vertical" />`, `{sidebar}`, close stage div) followed by the record `Card` (moved verbatim below the stage div, still inside `main`). Add `const stageRef = useRef<HTMLElement | null>(null)` plus `const attachStage = useCallback((node: HTMLElement | null) => { stageRef.current = node; }, [])` near the other attach callbacks. Visual result must be unchanged (same widths/gaps).

- [ ] **Step 2: Wrap the presentation content in the same stage ref**

In the `if (presentation)` return, wrap the preview column div, the `Separator`, and the sidebar div in `<div ref={attachStage} className="flex min-w-0 flex-1">`, leaving the session `Badge` and the End-session button outside. Only one branch renders at a time so the single ref is always the active stage.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors.

- [ ] **Step 4: Verify layout unchanged manually**

Dev server, editor + fullscreen: same widths/gaps as before; record bar sits below the stage row; End button and badge still visible in presentation.
Expected: pixel-equivalent layout, no visual regression.

- [ ] **Step 5: Commit**

```bash
git add app/components/editor-layout.tsx
git commit -m "refactor: dedicated stage containers excluding chrome"
```

### Task 2: Region Capture recorder hook + swap + delete canvas hook

**Files:**
- Create: `app/hooks/use-stage-recorder.ts`
- Delete: `app/hooks/use-composite-recorder.ts`
- Modify: `app/components/editor-layout.tsx`
- Test: `npm run build` + manual (no test runner in repo)

**Interfaces:**
- Consumes: `attachStage`/`stageRef` from Task 1 (pass `stageRef.current` as `stageEl` — read at `start()` call time, not render time, so the ref is always current); `micStream` state (already exists).
- Produces: nothing further (terminal task).

- [ ] **Step 1: Create `useStageRecorder` in `app/hooks/use-stage-recorder.ts`**

Export `useStageRecorder({ stageEl: HTMLElement | null; micStream: MediaStream | null }): { status: "idle" | "recording"; elapsedMs: number; error: string | null; notice: string | null; blobUrl: string | null; fileName: string; start: () => void; stop: () => Blob | null; clearError: () => void; clearNotice: () => void }`. Feature-detect via `(globalThis as unknown as { CropTarget?: { fromElement: (el: Element) => Promise<unknown> } }).CropTarget` (missing → `setError("Browser tidak mendukung perekaman stage. Gunakan Chrome/Edge terbaru.")`, refuse). `start()`: `getDisplayMedia({ video: true, audio: false, preferCurrentTab: true } as DisplayMediaStreamOptions)` in try/catch (`NotAllowedError`/`AbortError` → silent return); require `track.getSettings().displaySurface === "browser"` (else stop tracks, error `"Pilih tab browser (tab Creator Screen ini), bukan window/layar"`); `CropTarget.fromElement(stageEl)` (needs non-null `stageEl`, else error `"Stage tidak siap. Tutup dialog ini dan coba lagi."`); `(track as unknown as { cropTo: (t: unknown) => Promise<void> }).cropTo(cropTarget)` in try/catch (fail → stop tracks, error `"Pilih tab Creator Screen ini lalu coba lagi."`); append live mic audio tracks via `new MediaStream` (pattern from old hook); `MediaRecorder` with the same `MIME_FALLBACK` + `safeSupported` logic and 8 Mbps default for non-empty mime (copy both verbatim from the deleted file); 500 ms elapsed timer; `track.onmute` → `setNotice("Tab tidak aktif — frame berhenti.")`; `track.onended` → auto-stop partial + `setNotice("Berbagi layar berhenti — rekaman parsial tersimpan, silakan download.")`. `stop()` sync-null + blob via `onstop` state (pattern from old hook). Cleanup stops ONLY the cropped/share tracks it owns, never mic tracks (lesson from prior review). Unmount cleanup identical in scope. Reuse `fileNameFor` logic verbatim (same `creator-screen-YYYYMMDD-HHmm.webm` format).

- [ ] **Step 2: Swap the editor to the new hook and delete the old file**

In `app/components/editor-layout.tsx`: change the import to `useStageRecorder`, call `useStageRecorder({ stageEl: stageRef.current, micStream })`; delete `screenVideoEl`/`cameraVideoEl` states and `attachScreenVideo`/`attachCameraVideo` callbacks, replacing `ref={attachScreenVideo}` / `ref={attachCameraVideo}` with direct `screenVideoRef` / `cameraVideoRef` (the `srcObject` effects already use those refs). Then `rm app/hooks/use-composite-recorder.ts`. Record button: always enabled; replace the requirement hints with `"Pilih tab Creator Screen ini di dialog berikutnya."` plus the existing mic-off hint. Header subtitle → `"Rekam stage 1080p langsung — pilih tab ini."`. Add an effect mapping hook notice into the existing notice Alert: `useEffect(() => { if (recorder.notice) { setRecordNotice(recorder.notice); recorder.clearNotice(); } }, [recorder.notice, recorder, setRecordNotice])` — wait, `recorder` identity changes every render; depend on `[recorder.notice]` only and call stable `clearNotice`/`setRecordNotice` (both stable useCallbacks), with an eslint-disable comment matching the file's existing style.

- [ ] **Step 3: Verify zero canvas remains**

Run: `grep -rn "createElement(\"canvas\")\|requestAnimationFrame\|drawContain\|drawCover\|drawPanel\|drawTicker\|PIP_\|use-composite-recorder" app/`
Expected: no matches.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors.

- [ ] **Step 5: Verify recording manually (Chrome)**

Dev server: Record → pick this tab → 5 s → file equals stage pixels (preview + marquee + name + camera); mic on → audible; cancel picker → silent; pick a window → clear error; stop-share mid-record → partial + notice; switch tabs mid-record → mute notice; Firefox → browser message.
Expected: all hold.

- [ ] **Step 6: Commit**

```bash
git add app/hooks/use-stage-recorder.ts app/components/editor-layout.tsx
git commit -m "feat: region capture stage recording, canvas removed"
```
