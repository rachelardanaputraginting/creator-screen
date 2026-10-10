# Creator Screen — Region Capture Stage Recording (No Canvas)

- Date: 2026-10-10
- Status: draft, awaiting user review of this file
- Supersedes recorder parts of `2026-10-09-creator-screen-stage-recording-design.md`.
  Prior canvas replica (adaptive bg, drawn panel, ticker, avatar) is DELETED,
  not kept — explicit user directive. Non-Chromium browsers refuse with a
  clear message instead of falling back.

## 1. Intent

- File rekaman = piksel asli halaman Creator Screen ini (stage: preview +
  marquee + sidebar nama + kamera), apapun caranya, tanpa canvas.
- Teknologi: Region Capture (`CropTarget.fromElement` + `track.cropTo`)
  di atas self-tab share (`getDisplayMedia({ preferCurrentTab: true })`),
  lalu `MediaRecorder` seperti sekarang. Hasil riset (spike 2026-10-10):
  didukung Chrome/Edge/Opera 104+, `localhost:3000` sudah secure context.
- Constraints: Manrope, shadcn tokens/components only, no custom colors,
  no new npm dependencies, RAM minimal.

## 2. Architecture

- Hook lama `app/hooks/use-composite-recorder.ts` DIHAPUS total (termasuk
  seluruh fungsi gambar: adaptive bg, panel teks, ticker, avatar, wrapText,
  drawContain/drawCover). Diganti file baru `app/hooks/use-stage-recorder.ts`.
- `start()` (async): feature-detect `CropTarget` + `fromElement` (tak ada ->
  error "Browser tidak mendukung perekaman stage. Gunakan Chrome/Edge
  terbaru.", refuse) -> `getDisplayMedia({ video: true, audio: false,
  preferCurrentTab: true })` (cancel -> diam, tanpa error) -> pastikan
  `track.getSettings().displaySurface === "browser"` (bukan -> stop tracks,
  error "Pilih tab browser (tab Creator Screen ini), bukan window/layar")
  -> `CropTarget.fromElement(stageEl)` -> `track.cropTo(cropTarget)`
  (gagal -> stop tracks, error "Pilih tab Creator Screen ini lalu coba
  lagi") -> gabung mic audio bila ada (pola lama: track live ditempel
  langsung, tanpa AudioContext) -> `MediaRecorder` dengan mimeType fallback
  yang sudah ada (vp9 -> vp8 -> webm -> default) -> chunks -> Blob `.webm`
  -> object URL -> auto-download + tombol Download (pola lama).
- Stage element: SATU container per mode (editor / presentation), hanya satu
  yang ter-render dalam satu waktu; `ref` callback yang sama dipasang di
  keduanya. Isi stage: preview 16:9 + marquee + sidebar (About + kamera).
  Di luar crop: header, toolbar scene, record bar, footer, badge session,
  tombol End.
- Kamera/mic tetap stream terpisah untuk preview; file mendapat wajah +
  suara (bila mic on) sebagai piksel/suara asli halaman. Elemen video tak
  lagi dilewatkan ke hook (state `screenVideoEl`/`cameraVideoEl` dihapus
  bila tak dipakai; ref preview untuk `srcObject` dipertahankan).
- Record tidak lagi mensyaratkan Share Screen / kamera aktif. Kamera/mic
  opsional (preview apa adanya yang terekam). Share Screen + scene tetap
  ada sebagai pengisi konten opsional.
- Track `ended` (user stop-share via browser) tengah rekam -> auto-stop
  parsial + notice (pola lama). `track.onmute` (pindah tab) -> notice
  "Tab tidak aktif — frame berhenti" tanpa menghentikan rekaman.

## 3. Components and data flow

### Baru: `app/hooks/use-stage-recorder.ts`

- Signature return SAMA PERSIS dengan hook lama (`status`, `elapsedMs`,
  `error`, `blobUrl`, `fileName`, `start`, `stop`, `clearError`) agar wiring
  editor minimal. Args: `{ stageEl: HTMLElement | null; micStream:
  MediaStream | null }` (mirror dihapus — piksel asli).
- Hapus: `WIDTH/HEIGHT/PANEL_*/CAM_*/FPS` exports, `drawContain`,
  `drawCover`, `drawPanel`, `drawTicker`, `wrapText`, `roundRectPath`,
  `sampleAverage`, `initialsOf`, `themeFor`, `isVideoLive` (tak terpakai
  lagi di hook ini).
- `stop()` sinkron-null + blob via state (pola lama, MediaRecorder async).
  Cleanup hanya stop track milik sendiri (pelajaran review lalu): track
  hasil crop (milik recorder) di-stop; mic track milik editor JANGAN
  di-stop (pola `stopCanvasTracks` dipertahankan esensinya untuk track
  crop). Catatan: track crop berasal dari tab-share user — men-stop-nya
  mengakhiri indikator sharing browser, sudah benar.

### Hapus: `app/hooks/use-composite-recorder.ts`

- Hapus file. Satu-satunya importir (`editor-layout.tsx`) pindah ke hook
  baru. Verifikasi tidak ada importir lain via grep sebelum hapus.

### Edit: `app/components/editor-layout.tsx`

- `stageRef = useRef<HTMLElement | null>(null)` + callback ref; pasang di
  container stage editor (bungkus ulang: stage = preview + marquee +
  sidebar; record bar + toolbar KELUAR dari stage) dan di container stage
  presentation (preview + marquee + sidebar; badge + tombol End di luar).
- Hook call ganti ke `useStageRecorder({ stageEl, micStream })`; hapus
  `screenVideoEl`/`cameraVideoEl` state + `attachScreenVideo`/
  `attachCameraVideo` bila tak dipakai lagi (preview pakai ref biasa).
  Hati-hati: effect penempel `srcObject` memakai ref video — pertahankan
  ref-nya, hanya state mirror untuk hook yang dihapus bila tak perlu.
- Record bar: tombol Record selalu enabled; hint lama (wajib layar+kamera)
  diganti ("Pilih tab Creator Screen ini di dialog berikutnya" + "Mic off
  — file tanpa suara" bila mic off). Gagal fitur-browser -> Alert
  destructive via `recorder.error` (pola lama).
- Header subtitle: sesuaikan ("Rekam stage 1080p langsung — pilih tab ini.").

### Tetap (tidak disentuh)

- `AboutPanel` (+ `clean`), `ThemeToggle`, `TechMarquee` + `TECH_ITEMS`,
  `app/lib/about.ts`, mic enable/stop + `ended`, recordNotice/Alert,
  auto-download effect, Esc handling, End button.

## 4. RAM budget

1. Nol kanvas, nol rAF, nol sampling, nol AudioContext.
2. Encode oleh compositor/encoder native browser atas stream tab-crop.
3. Track crop di-stop tiap akhir (stop/cancel/unmount); mic milik editor.
4. Chunks dilepas setelah Blob (pola lama). Bitrate default MediaRecorder
   (tak ditentukan manual — encoder browser yang memilih; catat: ukuran
   file mengikuti resolusi stage di layar).

## 5. Error handling and limits

- Cancel picker -> diam (return, tanpa error, tanpa state berubah).
- Bukan tab (window/monitor) -> error jelas + tracks di-stop.
- `cropTo` gagal -> error + tracks di-stop.
- Non-Chromium -> refuse + pesan gunakan Chrome/Edge.
- Tab disembunyikan tengah rekam (`onmute`) -> notice, rekaman jalan terus
  (frame beku — perilaku standar perekam tab).
- Resolusi file = ukuran stage di layar x DPR; fullscreen/session
  disarankan untuk hasil terbesar (header Start Session sudah ada).

## 6. Testing

- `npm run build` passes; token grep bersih; grep pastikan tak ada sisa
  import `use-composite-recorder` / `PIP_*` / `drawPanel` di `app/`.
- Manual (Chrome, wajib): (1) Record -> pilih tab ini -> file == piksel
  stage (preview + marquee + nama + kamera); (2) mic on -> ada suara;
  (3) cancel picker -> diam; (4) pilih window -> error jelas;
  (5) stop-share tengah jalan -> parsial + notice; (6) pindah tab tengah
  rekam -> notice mute; (7) Firefox/Safari -> pesan browser rapih.
