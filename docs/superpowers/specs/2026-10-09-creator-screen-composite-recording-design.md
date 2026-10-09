# Creator Screen — Content-Focused Layout + Composite HD Recording + Tech Marquee

- Date: 2026-10-09
- Approach: A (approved) — composite canvas + CSS marquee, no new dependencies
- Status: draft, awaiting user review of this file

## 1. Intent

- Make the layout more minimal with content as the hero: 16:9 preview full-width,
  supporting strip below it, narrow right sidebar kept but visually lighter.
- Fill the space below the 16:9 preview with a professional tech-stack marquee
  (static list, CSS-only, shadcn tokens, Manrope).
- Add in-browser HD screen recording of screen + camera combined with download.
- Constraints: Manrope font, shadcn/ui tokens and components only, no custom
  colors unless required. No new npm dependencies.

## 2. Architecture

- Single browser tab, no server work.
- Existing sources stay: `getDisplayMedia` (screen) and `getUserMedia` (camera).
- New hidden compositor: `<canvas width=1920 height=1080>` (not displayed).
- New hook `useCompositeRecorder` owns the render loop and `MediaRecorder`.
- Render loop (`requestAnimationFrame`):
  1. Draw screen video frame full-bleed with contain-fit on muted background.
  2. Draw camera video frame as fixed PiP 480x270 bottom-right with mirror option.
  3. No marquee, sidebar, or header is drawn — recording is content only.
- Output: `canvas.captureStream(30)` into `MediaRecorder` with mimeType fallback
  `video/webm;codecs=vp9` -> `video/webm;codecs=vp8` -> `video/webm` -> default.
- Layout: left content column (compact toolbar, 16:9 preview card, marquee card,
  record bar) and narrow right sidebar (About + Camera cards).

## 3. Components and data flow

### New: `app/components/tech-marquee.tsx`

- Static list, fixed in code as a constant (edit the constant to change items):
  Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Zustand, MediaRecorder,
  1080p HD.
- CSS keyframes translate loop; list duplicated once for seamless wrap;
  duplicate marked `aria-hidden`.
- shadcn tokens only (`bg-muted`, `text-muted-foreground`); pause on hover;
  `prefers-reduced-motion` disables animation.

### New: `app/hooks/use-composite-recorder.ts`

- Inputs: screen video element, camera video element, mirror flag.
- State: `status` (idle | recording), `elapsedMs`, `error`, `blobUrl`, `fileName`.
- `start()` requires both streams active; creates chunks array, starts
  `MediaRecorder` with fallback mimeType, starts rAF draw loop.
- `stop()` stops loop and recorder, builds `Blob(video/webm)`, creates object URL,
  sets filename `creator-screen-YYYYMMDD-HHmm.webm`, revokes previous URL.
- Cleanup on unmount: cancel rAF, stop recorder if active, revoke URL.

### Edit: `app/components/editor-layout.tsx`

- Below preview card: marquee card, then record bar card with Record/Stop button,
  REC `Badge` + duration, Download button (appears after stop), and auto-download
  on stop.
- Record button disabled unless screen and camera are both on, with reason text.
- Header copy updated: remove "recording happens on your phone"; replace with
  in-browser recording description.
- Recording errors surface through existing `Alert` destructive pattern.

### Data flow

Start (screen + camera on) -> rAF composite -> MediaRecorder chunks -> Stop ->
Blob `.webm` -> object URL -> auto-download + manual Download button.

## 4. Error handling and limits

- Video-only output (no audio); PiP position fixed; 1080p fixed; ~30fps target.
- Disabled states: Record disabled when either stream is off.
- Mid-record stream end (user stops share): auto-stop, keep partial file,
  show informational `Alert`.
- Unsupported mimeType: fall back down the list; if all fail, show error and
  refuse to start.
- Memory: revoke prior object URLs; chunks released after Blob creation.

## 5. Testing

- `npm run build` passes.
- Manual checklist:
  1. Record disabled without both streams, enabled with both.
  2. 5-second recording produces downloadable playable `.webm`.
  3. Mirror toggle is reflected in the recorded PiP.
  4. Mid-record share-stop auto-saves partial file with notice.
  5. Marquee loops seamlessly, pauses on hover, static under reduced motion.
  6. No custom colors introduced (grep for `bg-black`, `text-neutral-`,
     `border-white`, `bg-neutral`, `text-gray-` in `app/` returns nothing new).
- No automated tests exist in this repo; none added (matches current workflow).
