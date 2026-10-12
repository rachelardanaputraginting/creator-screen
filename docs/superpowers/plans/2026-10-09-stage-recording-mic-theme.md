# Stage Recording + Mic + Theme + Fullscreen Marquee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the Creator Screen stage itself (screen + info panel + camera) with optional mic audio, keep the marquee visible in fullscreen, add a persisted dark/light toggle, and hold idle RAM at zero loops/contexts.

**Architecture:** New `app/lib/about.ts` becomes the single source of truth for profile data; the recorder hook is reworked from screen+PiP composite into a stage renderer that draws the screen left and a text+camera panel right on the hidden 1920x1080 canvas, merging a live mic audio track directly when present; theme is a class toggle with a pre-paint init script; the presentation branch gains the marquee.

**Tech Stack:** Next.js 16 + React 19, Tailwind v4 + shadcn/ui tokens/components, Manrope, MediaRecorder + canvas.captureStream + getUserMedia audio.

**Spec:** `docs/superpowers/specs/2026-10-09-creator-screen-stage-recording-design.md`

## Global Constraints

- Manrope font, shadcn/ui tokens and components only, no custom colors for UI (canvas pixel content exempt, as before), no new npm dependencies.
- Recording is fixed 1080p, ~30fps, 8 Mbps, filename `creator-screen-YYYYMMDD-HHmm.webm`.
- Mic is optional for Record (requirements stay screen + camera); mic failure at start refuses with an error.
- Toolbar, marquee, and buttons are never drawn into the file - stage only.
- This repo has no test runner and no existing tests; verification is `npm run build` plus the manual checklist and token grep from the spec.

## Review Focus

- Mic track ends mid-recording still saves a partial file and shows a notice instead of a silent/corrupt take (covered in Task 4).
- Profile edited mid-recording shows the new name in the recorded panel, not the stale one (covered in Task 4).
- Theme toggle persists across reload with no light-flash and defaults to dark on first visit (covered in Task 2).
- Fullscreen shows the marquee below the preview without shrinking the 16:9 stage or breaking the sidebar (covered in Task 3).
- Very long bio text never overflows the recorded panel or crashes the draw loop (covered in Task 4).

---

### Task 1: About data single source of truth

**Files:**

- Create: `app/lib/about.ts`
- Modify: `app/components/about-panel.tsx`
- Test: `npm run build` + manual (no test runner in repo)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `AboutData` (exported interface `{ name: string; role: string; bio: string; link: string }`), `STORAGE_KEY = "creator-screen-about"`, `DEFAULT_ABOUT: AboutData` (values: name "Nama Kamu", role "Software Engineer", bio "Halo! Saya membuat konten coding dan tutorial.", link "@username"), `readAbout(): AboutData` (reads localStorage, merges over defaults, try/catch fallback to defaults) - all from `app/lib/about.ts`, consumed by Task 4.

- [ ] **Step 1: Create `readAbout` + constants in `app/lib/about.ts`**

Export `AboutData`, `STORAGE_KEY`, `DEFAULT_ABOUT` (exact values above), and `readAbout(): AboutData` that try/catches `localStorage.getItem` + `JSON.parse` and returns `{ ...DEFAULT_ABOUT, ...parsed }`.

- [ ] **Step 2: Refactor `AboutPanel` to import from the lib**

Replace the local `AboutData` interface, `STORAGE_KEY`, and `DEFAULT_ABOUT` in `app/components/about-panel.tsx:17-30` with imports from `@/app/lib/about`. No behavior or copy changes.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/lib/about.ts app/components/about-panel.tsx
git commit -m "refactor: single source of truth for about data"
```

### Task 2: Dark/light theme toggle

**Files:**

- Create: `app/components/theme-toggle.tsx`
- Modify: `app/layout.tsx`
- Test: `npm run build` + manual (no test runner in repo)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `ThemeToggle` (default export, no props) used by Task 3 in the header.

- [ ] **Step 1: Create `ThemeToggle` in `app/components/theme-toggle.tsx`**

Client component, default-export function `ThemeToggle(): React.JSX.Element`. State `dark: boolean` initialized `true`; on mount read `localStorage.getItem("creator-screen-theme")` (`"light"` → false, anything else → true) and apply. Toggle flips `document.documentElement.classList` (`dark` on/off) and persists `"dark"`/`"light"`. Render `Button size="sm" variant="ghost"` with `Sun` icon when dark, `Moon` when light, `aria-label` "Toggle theme".

- [ ] **Step 2: Remove hardcoded dark + add pre-paint init in `app/layout.tsx`**

Change `<html>` class from `` `${manrope.variable} dark` `` to `manrope.variable` only, and add `import Script from "next/script"` with `<Script id="theme-init" strategy="beforeInteractive">` containing a small IIFE that reads `creator-screen-theme` and adds `dark` unless the stored value is `"light"` (runs before paint, no flash). Keep Manrope variable and all other markup identical.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors.

- [ ] **Step 4: Verify persistence manually**

Run dev server: default dark on first visit; toggle to light; reload - stays light with no flash; toggle back persists dark.
Expected: all hold.

- [ ] **Step 5: Commit**

```bash
git add app/components/theme-toggle.tsx app/layout.tsx
git commit -m "feat: dark/light theme toggle"
```

### Task 3: Marquee in fullscreen + header toggle + camera/mic card UI

**Files:**

- Modify: `app/components/editor-layout.tsx`
- Test: `npm run build` + manual (no test runner in repo)

**Interfaces:**

- Consumes: `ThemeToggle` from Task 2 as `<ThemeToggle />`; mic state/handlers are local to this file (produced here for Task 4's wiring: `micOn: boolean`, `micStream: MediaStream | null` state passed to the hook).
- Produces: mic UI + `micStream` state consumed by Task 4.

- [ ] **Step 1: Render marquee in the presentation branch**

In the `if (presentation)` return, change `<div className="min-w-0 flex-1 p-4">{screenPreview}</div>` into a flex column (`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4`) containing `{screenPreview}` followed by `<TechMarquee />`. Sidebar and end-session button untouched.

- [ ] **Step 2: Add `ThemeToggle` to the header button row**

Insert `<ThemeToggle />` as the first child of the header action `div` (before the Fullscreen button). No other header changes.

- [ ] **Step 3: Add mic state, handlers, and card UI**

Add `micOn` boolean state, `micStreamRef = useRef<MediaStream | null>(null)`, `micStream` state (for the hook). `handleEnableMic`: `getUserMedia({ video: false, audio: true })`, store stream, `setMicOn(true)`, attach `ended` listener on the audio track that calls `handleStopMic`. `handleStopMic`: stop tracks, null refs, `setMicOn(false)`. Retitle card to "Kamera & Mic", keep camera UI identical, append a mic row mirroring the camera row pattern: `Badge` (`secondary` when on, `outline` when off, labels "Mic on"/"Mic off") + `Button size="sm" variant="outline"` ("Aktifkan mic" with `Mic` icon / "Matikan mic" with `MicOff` icon). Mic failure sets `mediaError` ("Unable to access the microphone. Check your system permissions and try again.").

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors.

- [ ] **Step 5: Verify marquee + theme + mic UI manually**

Dev server: open fullscreen - marquee visible below preview; toggle theme in header, reload - persists; enable/disable mic - badge and buttons follow; unplug/kill mic track - mic returns to off without crash.
Expected: all hold.

- [ ] **Step 6: Commit**

```bash
git add app/components/editor-layout.tsx
git commit -m "feat: fullscreen marquee, theme toggle, mic controls"
```

### Task 4: Stage renderer + mic audio in the recorder hook

**Files:**

- Modify: `app/hooks/use-composite-recorder.ts`
- Modify: `app/components/editor-layout.tsx` (wire `micStream`, hint copy, mic-death handling)
- Test: `npm run build` + manual (no test runner in repo)

**Interfaces:**

- Consumes: `readAbout(): AboutData` + `AboutData` type from Task 1; `micStream: MediaStream | null` state from Task 3.
- Produces: nothing further (terminal task).

Deviation from spec (deliberate, RAM-driven): the spec's `AudioContext -> MediaStreamDestination` step is replaced with direct append of the mic audio track (`new MediaStream([...videoTracks, ...audioTracks])`) - a single audio source needs no mixing graph, and skipping the context upholds the zero-idle-context RAM budget. Behavior is identical.

- [ ] **Step 1: Rework the draw loop into a stage renderer**

Replace PiP constants with `PANEL_X = 1560`, `PANEL_W = 360`, `PANEL_PAD = 24`, `CAM_W = 312`, `CAM_H = 176`. Each frame: fill `#000`; draw screen contain-fit in `(24, 24, 1536, 1032)` via existing `drawContain`; fill panel rect `(1560, 0, 360, 1080)`; draw cached about (name `600 44px Manrope, sans-serif` `#FFFFFF`, role `28px` `#B0B0B0`, bio wrapped `26px` `#B0B0B0` max 4 lines with ellipsis, link `26px` `#B0B0B0`) with a `wrapText(ctx, text, maxWidth): string[]` helper; draw camera cover-fit below the text block at `(1584, camY, 312, 176)` honoring `mirrorRef`. About cache: `aboutRef = useRef(readAbout())`, refreshed inside the existing 500ms interval (every 4th tick ≈ 2s). Delete `PIP_W`/`PIP_H`/`PIP_MARGIN` exports (nothing else imports them - verified).

- [ ] **Step 2: Merge mic audio at `start()`**

Add `micStream: MediaStream | null` to `CompositeRecorderArgs` and the `start` dependency list. After `canvas.captureStream(FPS)`, collect `micStream?.getAudioTracks().filter((t) => t.readyState === "live")`; if non-empty, record `new MediaStream([...stream.getVideoTracks(), ...audioTracks])`, else record `stream` unchanged (video-only). Mic start failure refuses via the editor's `mediaError` path (Task 3), so the hook needs no new error branch.

- [ ] **Step 3: Wire `micStream` + hint + mic-death handling in `editor-layout.tsx`**

Pass `micStream` state into `useCompositeRecorder`. Record bar: under the Record button hint area, when `!micOn` show `Mic off - file tanpa suara.` alongside existing hints. Extend the `statusRef` stream-death pattern: in `handleStopMic`, if recording, call `recorder.stop()` and set notice `Mic berhenti - rekaman parsial tersimpan, silakan download.` (the track `ended` listener already routes through `handleStopMic`).

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors.

- [ ] **Step 5: Verify recording manually**

Dev server with screen + camera: record 5s with mic on - file plays video of the stage (screen left, name + camera right) with audible mic; record with mic off - video-only; kill mic mid-record - partial + notice; edit name mid-record - file shows the new name; very long bio - panel clips with ellipsis, no crash; idle with mic off and not recording - no rAF/AudioContext alive (devtools memory flat).
Expected: all hold; token grep `bg-black|text-neutral-|border-white|bg-neutral|text-gray-` in `app/` shows nothing new.

- [ ] **Step 6: Commit**

```bash
git add app/hooks/use-composite-recorder.ts app/components/editor-layout.tsx
git commit -m "feat: stage recording with mic audio"
```
