# Content-Focused Recording + Marquee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CSS-only tech marquee below the 16:9 preview and in-browser 1080p composite (screen + camera PiP) recording with `.webm` download.

**Architecture:** Hidden 1920x1080 canvas compositor driven by a new `useCompositeRecorder` hook (rAF loop + `MediaRecorder` with mimeType fallback); presentational `TechMarquee` component with keyframes in `globals.css`; wiring in `editor-layout.tsx`. No new npm dependencies.

**Tech Stack:** Next.js 16 + React 19, Tailwind v4 + shadcn/ui tokens/components, Manrope, browser MediaRecorder + canvas.captureStream.

**Spec:** `docs/superpowers/specs/2026-10-09-creator-screen-composite-recording-design.md`

## Global Constraints

- Manrope font, shadcn/ui tokens and components only, no custom colors unless required.
- No new npm dependencies.
- Recording output is video-only, fixed 1080p, ~30fps, fixed PiP position.
- Filename format is `creator-screen-YYYYMMDD-HHmm.webm`.
- Marquee list is a fixed constant: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Zustand, MediaRecorder, 1080p HD.
- This repo has no test runner and no existing tests; verification is `npm run build` plus the manual checklist and token grep from the spec.

## Review Focus

- Screen share ended via browser UI mid-recording still saves a partial file and shows a notice instead of losing the take (covered in Task 3).
- Camera track ends mid-recording still stops cleanly with partial file and notice (covered in Task 3).
- Browser without vp9/vp8 support falls back through the mimeType list and refuses with an error rather than throwing (covered in Task 2).
- `prefers-reduced-motion` renders the marquee static instead of animating (covered in Task 1).
- Record clicked with streams missing stays disabled with a reason, never starts a broken session (covered in Task 3).

---

### Task 1: Tech marquee component + keyframes

**Files:**
- Create: `app/components/tech-marquee.tsx`
- Modify: `app/globals.css`
- Test: manual + build (no test runner in repo)

**Interfaces:**
- Consumes: shadcn tokens only (`bg-muted`, `text-muted-foreground`); nothing from other tasks.
- Produces: `TechMarquee` (default export, no props) used by Task 3 as `<TechMarquee />`; constant `TECH_ITEMS: string[]` exported for the list.

- [ ] **Step 1: Add marquee keyframes to `app/globals.css`**

Append a plain-CSS block defining `@keyframes tech-marquee { to { transform: translateX(-50%); } }`, class `.animate-tech-marquee { animation: tech-marquee 30s linear infinite; }`, hover-pause rule, and a `prefers-reduced-motion` rule disabling it. No new colors.

- [ ] **Step 2: Create `TechMarquee` in `app/components/tech-marquee.tsx`**

Default-export function `TechMarquee(): React.JSX.Element` rendering a `Card size="sm"` with overflow-hidden row: visible list + one `aria-hidden` duplicate, items from `TECH_ITEMS`, separated by dot markers, tokens only.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully` and no TypeScript errors.

- [ ] **Step 4: Verify reduced-motion + hover behavior manually**

Run dev server, inspect marquee: loops seamlessly, pauses on hover, static with reduced motion emulated.
Expected: all three hold.

- [ ] **Step 5: Commit**

```bash
git add app/components/tech-marquee.tsx app/globals.css
git commit -m "feat: add tech marquee strip"
```

### Task 2: Composite recorder hook

**Files:**
- Create: `app/hooks/use-composite-recorder.ts`
- Test: typecheck via build + manual recording checklist (no test runner in repo)

**Interfaces:**
- Consumes: `HTMLVideoElement | null` refs for screen and camera, `mirror: boolean`.
- Produces: `useCompositeRecorder(args: { screenVideo: HTMLVideoElement | null; cameraVideo: HTMLVideoElement | null; mirror: boolean }): { status: "idle" | "recording"; elapsedMs: number; error: string | null; blobUrl: string | null; fileName: string; start: () => void; stop: () => Blob | null; clearError: () => void }` used by Task 3. Constants: `WIDTH = 1920`, `HEIGHT = 1080`, `PIP_W = 480`, `PIP_H = 270`, `FPS = 30`, mimeType fallback list `["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", ""]`.

- [ ] **Step 1: Implement `useCompositeRecorder` with fallback + cleanup**

Create the hook: hidden canvas 1920x1080; `start()` picks first supported mimeType via `MediaRecorder.isTypeSupported`, refuses with error string when streams are missing or no mimeType works; rAF loop draws screen contain-fit then camera PiP bottom-right with mirror via `ctx.save/scale(-1,1)`; `stop()` ends loop and recorder, builds `Blob(chunks, { type: "video/webm" })`, revokes prior URL, creates new URL + `creator-screen-YYYYMMDD-HHmm.webm` name; unmount cleanup cancels rAF, stops recorder, revokes URL; 1s interval timer drives `elapsedMs` while recording.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors.

- [ ] **Step 3: Verify fallback refuses cleanly (manual)**

Temporarily stub `MediaRecorder.isTypeSupported` to false for all entries in devtools, click Record with both streams on.
Expected: `error` set, status stays `idle`, no exception. Restore afterwards.

- [ ] **Step 4: Commit**

```bash
git add app/hooks/use-composite-recorder.ts
git commit -m "feat: add composite HD recorder hook"
```

### Task 3: Editor layout wiring (marquee + record bar + auto-stop)

**Files:**
- Modify: `app/components/editor-layout.tsx`

**Interfaces:**
- Consumes: `TechMarquee` from Task 1, `useCompositeRecorder` from Task 2 with exact signature above.
- Produces: working record bar UI; no new exports.

- [ ] **Step 1: Wire hook + record bar below preview**

In the left content column after `{screenPreview}`, render `<TechMarquee />` then a `Card size="sm"` record bar: Record/Stop `Button` (disabled unless `screenOn && cameraOn`, with reason text naming the missing source), REC `Badge` + `mm:ss` duration from `elapsedMs` while recording, Download `Button` when `blobUrl` exists, auto-trigger `<a download={fileName} href={blobUrl}>` click on transition to stopped-with-file. Header subtitle becomes in-browser recording copy. Preview empty-state copy mentioning phone recording updated to match.

- [ ] **Step 2: Handle mid-record stream death**

Subscribe to existing `stopScreenTracks`/`stopCameraTracks` paths and the `ended` event on the screen track: if `status === "recording"`, call `stop()`, keep partial file, set info notice through the existing destructive/info `Alert` pattern.
Expected: partial `.webm` preserved, notice shown, no crash.

- [ ] **Step 3: Verify full manual checklist from the spec**

Run: `npm run build`, then manual: disabled states, 5s record to playable download, mirror reflected in PiP, mid-record stop preserves partial, marquee intact.
Expected: all pass; grep `bg-black|text-neutral-|border-white|bg-neutral|text-gray-` in `app/` shows nothing new.

- [ ] **Step 4: Commit**

```bash
git add app/components/editor-layout.tsx
git commit -m "feat: wire marquee and HD record bar into editor"
```
