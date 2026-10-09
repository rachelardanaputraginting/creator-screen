# Creator Screen — Stage Recording + Marquee di Fullscreen + Theme Toggle + Mic

- Date: 2026-10-09
- Status: draft, awaiting user review of this file
- Supersedes (recorder part only): `2026-10-09-creator-screen-composite-recording-design.md`
  (composite screen+PiP). Marquee component, Manrope, shadcn-only constraints stay.

## 1. Intent

- Yang direkam adalah tampilan stage Creator Screen itu sendiri — komposisi
  layar + panel info (nama/role/bio/link) + wajah kamera — bukan source layar
  mentah yang dibagikan. Itu alasan panel info + kamera ada di kanan.
- Marquee tech-stack tetap tampil di fullscreen/presentation, tidak hilang.
- Toggle dark/light mode tersedia di header, pilihan persist.
- Kontrol mic on/off tersedia; suara mic masuk file rekaman; mic opsional
  untuk tombol Record (syarat tetap layar + kamera).
- RAM minimal: tidak ada loop/konteks hidup saat idle.
- Constraints: Manrope, shadcn/ui tokens + components only, no custom colors
  for UI (canvas pixel content exempt, as before), no new npm dependencies.

## 2. Architecture

- Recorder hook dirombak dari composite screen+PiP menjadi stage renderer:
  hidden canvas 1920x1080 menggambar replika stage aplikasi tiap frame via
  `requestAnimationFrame` (hanya saat recording):
  1. Area kiri (0..1560): screen video contain-fit dengan padding, letterbox.
  2. Panel kanan (1560..1920): teks info (nama bold, role, bio wrap, link)
     dibaca dari storage yang sama dengan AboutPanel, lalu kamera di bawah
     teks info (cover-fit). Tidak ada toolbar/marquee/tombol yang ikut
     digambar — itu editor chrome, bukan stage.
- About data dibaca via helper bersama `readAbout()` (localStorage key
  `creator-screen-about` + defaults sama); dibaca ulang tiap 2 detik saat
  recording agar edit nama tengah jalan ikut ke file.
- Font canvas: `Manrope, sans-serif` (pakai font yang sudah dimuat app,
  fallback sans-serif).
- Mic: `getUserMedia({ video: false, audio: true })` on-demand saat mic on;
  `AudioContext` -> `MediaStreamDestination`; saat `start()`, jika mic on,
  stream yang direkam = `new MediaStream([...canvasStream.getVideoTracks(),
  ...dest.stream.getAudioTracks()])`. Mic off = video-only seperti sekarang.
  `AudioContext.close()` + stop track saat mic off.
- Theme: komponen `ThemeToggle` toggle class `dark` di `documentElement`,
  persist `localStorage` (`creator-screen-theme`, default dark). `layout.tsx`
  tidak lagi memaksa `dark`; inisialisasi via inline script kecil di
  `layout.tsx` yang membaca localStorage sebelum paint (tanpa flash).
- Marquee: render `<TechMarquee />` juga di branch presentation/fullscreen
  di bawah preview (layout kolom, bukan overlay).

## 3. Components and data flow

### Edit: `app/hooks/use-composite-recorder.ts` (rename konsep jadi stage)

- Tambah gambar panel kanan: teks + kamera (posisi kamera pindah dari
  kanan-bawah overlay menjadi panel kanan di bawah teks info).
- Input hook bertambah: `about: { name, role, bio, link }` (dibaca caller)
  atau hook membaca sendiri via helper — putuskan: caller (`editor-layout`)
  yang membaca + me-refresh tiap 2 detik lebih transparan untuk testing.
  Pilih: hook terima `getAbout: () => AboutData` agar drawing loop selalu
  fresh tanpa re-render. Sederhana: hook import `readAbout` langsung.
  Keputusan final: hook import helper dari `app/lib/about.ts` (baru, kecil).
- Mic audio: input `micStream: MediaStream | null`; `start()` gabung track
  audio jika ada; mimeType fallback tetap.
- About data: hook import `readAbout` dari `app/lib/about.ts` langsung dan
  memanggilnya tiap ~2 detik dalam loop (via timer yang sama dengan elapsed)
  agar edit nama tengah rekam ikut ke file tanpa re-render.
- Batasan tetap: 1080p, ~30fps, 8 Mbps, filename sama.
- Assumption (koreksi saat review bila salah): toolbar, marquee, dan tombol
  tidak ikut direkam — hanya stage (layar + panel info + kamera).

### Baru: `app/lib/about.ts`

- `AboutData` type + `DEFAULT_ABOUT` + `readAbout(): AboutData`
  (satu sumber kebenaran; AboutPanel refactor memakainya).

### Edit: `app/components/about-panel.tsx`

- Pakai `readAbout`/`DEFAULT_ABOUT` dari lib (perilaku sama).

### Baru/Edit: theme

- Baru `app/components/theme-toggle.tsx`: tombol Sun/Moon
  (`variant="ghost"`, `size="sm"`), toggle class + persist.
- Edit `app/layout.tsx`: hapus `dark` hardcoded; tambah inisialisasi theme
  (inline script baca localStorage sebelum paint).

### Edit: `app/components/editor-layout.tsx`

- Kartu kamera jadi "Kamera & Mic": tombol mic on/off + badge + indikator.
  State `micOn`, `micStreamRef`, `handleEnableMic`/`handleStopMic`
  (+ `ended` listener auto-stop mic).
- Record bar: syarat tetap layar+kamera; hint mic opsional
  ("Mic off — file tanpa suara").
- Mic mati tengah rekam: hentikan rekaman parsial + notice, sama pola
  stream-death (mengganti track live di MediaRecorder tidak didukung
  andal).
- Presentation branch: tambah `<TechMarquee />` di bawah preview.
- Header: tambah `<ThemeToggle />`, update subtitle (sudah in-browser).

## 4. RAM budget (explicit)

1. rAF + canvas 1080p hanya saat recording (tetap).
2. `AudioContext` hanya saat mic on; `close()` + track stop saat off.
3. Track screen/kamera/mic dihentikan tiap toggle off (tetap + mic baru).
4. Chunks dilepas setelah Blob (tetap). Bitrate tetap 8 Mbps.
5. Tidak ada canvas/DOM ganda: satu canvas tersembunyi, digambar ulang
   tiap frame (tidak ada buffer frame menumpuk).

## 5. Error handling and limits

- Video-only saat mic off; mic on tapi start gagal -> error Alert dan
  recording ditolak mulai (eksplisit; minta ubah saat review bila ingin
  video-only + notice).
- Liveness guard diperluas ke mic? Tidak perlu — mic opsional.
- Theme: default dark bila belum ada pilihan tersimpan.
- Marquee di fullscreen: layout kolom preview + marquee + sidebar tetap;
  di layar kecil sidebar boleh scroll (perilaku sekarang).

## 6. Testing

- `npm run build` passes; token grep bersih.
- Manual: (1) marquee tampil di fullscreen; (2) toggle theme persist
  reload tanpa flash; (3) mic on/off + badge; (4) rekam mic on -> file
  ada suara + panel info + kamera terbakar di kanan; (5) mic off ->
  video-only; (6) mic mati tengah rekam -> parsial + notice;
  (7) edit nama tengah rekam -> file memakai nama baru (cek visual);
  (8) idle (tidak rekam, mic off) -> tidak ada rAF/AudioContext hidup
  (profil memory flat di devtools).
