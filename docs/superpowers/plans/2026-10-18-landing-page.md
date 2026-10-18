# Landing Page + Distribusi Windows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `creator.chelution.com` menampilkan landing page Bahasa Indonesia di `/` dengan tombol Download yang benar-benar menghasilkan installer Windows terpasang, sementara editor pindah ke `/app` tanpa perubahan perilaku.

**Architecture:** Dua route group di aplikasi Next yang sudah ada (static export): `(marketing)` memiliki `/` sebagai Server Component, `(app)` memiliki `/app` berisi editor hari ini. Shell Electron memuat `app://bundle/app.html`. Installer dibuat dengan electron-builder (NSIS), diterbitkan ke GitHub Releases, dan dirujuk dari satu modul konfigurasi. Situs di-host statis di Cloudflare Pages.

**Tech Stack:** Next 16.3.6 (`output: export`), React 19.2.8, Tailwind v4 (`@theme`), shadcn base-nova, Electron 44.9.0, electron-builder, Node 22.12.0, pnpm 10.6.3, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-creator-screen-landing-page-design.md`

## Global Constraints

- Semua copy landing dalam Bahasa Indonesia; setiap klaim harus benar untuk aplikasi yang ada.
- Tidak ada angka, kuota, testimoni, ukuran berkas, atau label versi karangan. Nilai di `app/lib/download.ts` diisi **setelah** artefaknya ada.
- Satu aksen saja (`--color-accent`); tanpa gradien ungu, tanpa emoji sebagai ikon, tanpa kartu rounded + border kiri berwarna, tanpa gambar manusia bikinan, tanpa foto stok.
- Landing adalah Server Component; hanya aset statisnya sendiri yang ikut terkirim untuk `/`.
- Perilaku `/app` tidak boleh berubah; apa pun yang khusus Electron tetap di balik `window.creatorScreen`.
- Screenshot diambil dari aplikasi yang berjalan dengan kamera pola-uji sintetis dan jendela demo yang dibuka sendiri; tidak pernah menangkap desktop asli pemilik mesin.
- Perintah verifikasi, semuanya harus lulus: `pnpm test`, `npx tsc --noEmit`, `pnpm lint` (≤ 17 masalah, tidak bertambah), `pnpm build`.
- Installer: Windows x64, NSIS, tanpa code signing (peringatan SmartScreen dijelaskan di FAQ).
- Artefak installer tidak pernah masuk repo (`.gitignore`).

## Review Focus

Kelas input / mode kegagalan yang tidak dipatok oleh test otomatis, masing-masing
mendapat pemeriksaan di task yang memilikinya:

1. **Pengunjung 360 px** — halaman bisa dibaca, tidak ada scroll horizontal, tombol tetap terlihat. → Task 5.
2. **Pengunjung yang localStorage editor-nya menyimpan tema gelap** membuka `/` — landing harus tetap terang. → Task 5.
3. **Orang membuka `creator.chelution.com/app` langsung** (deep link) di host statis yang mengabaikan `_redirects`. → Task 5 (emulasi lokal) dan Task 8 (situs live).
4. **Aplikasi packaged (asar) membaca `out/`** — perubahan aset/rute tidak boleh membuat desktop app layar putih. → Task 6.
5. **Tombol Download ditekan sebelum release ada** — tidak boleh jadi tautan mati atau menampilkan ukuran/versi karangan. → Task 5 (flag `ready`) dan Task 7 (diaktifkan setelah URL terbukti 200).

---

## File structure

| File | Aksi | Tanggung jawab |
|------|------|----------------|
| `app/layout.tsx` | modify | Root: `<html lang="id">`, dua font (Manrope + Bricolage Grotesque), script tema tetap di sini (`beforeInteractive` wajib di root layout) |
| `app/(app)/layout.tsx` | create | Pembungkus `h-dvh overflow-hidden flex flex-col` untuk editor |
| `app/(app)/app/page.tsx` | create | Editor hari ini (dipindah dari `app/page.tsx`) |
| `app/(marketing)/layout.tsx` | create | Latar `bg-paper`, metadata landing |
| `app/(marketing)/page.tsx` | create | Menyusun bagian-bagian landing sebagai Server Component |
| `app/(marketing)/components/*.tsx` | create | Nav, hero, kenapa, fitur, langkah, galeri, FAQ, footer, `brand-mark` |
| `app/lib/mark.json` | create | Geometri & warna marka (satu sumber, dipakai komponen dan skrip ikon) |
| `app/lib/landing-content.ts` | create | Data fitur, langkah, FAQ, galeri (copy Bahasa Indonesia) |
| `app/lib/download.ts` | create | Satu-satunya sumber kebenaran URL/versi installer + flag `ready` |
| `app/icon.svg` | create | Favicon (dihasilkan skrip, bukan ditulis tangan) |
| `app/globals.css` | modify | Token brand di blok `@theme inline` |
| `scripts/brand/build-assets.mjs` | create | Menghasilkan `app/icon.svg`, `build/icon.ico`, `build/icon.png` dari `mark.json` |
| `scripts/serve-out.mjs` | create | Menyajikan `out/` secara lokal dengan fallback `/x` → `x.html`, meniru perilaku `_redirects` di host |
| `scripts/screenshots/demo-stage.html` | create | Konten demo untuk jendela sumber (aman dipublikasikan) |
| `scripts/screenshots/capture.mjs` | create | Menjalankan aplikasi + jendela demo, mengambil tangkapan layar ke `public/landing/` |
| `public/landing/*.webp` | create | Tangkapan layar asli |
| `public/_redirects` | create | `/app /app.html 200` |
| `public/robots.txt` | create | Mengizinkan crawler |
| `electron/main.js` | modify | Muat `app://bundle/app.html` |
| `electron-builder.yml` | create | Konfigurasi installer NSIS |
| `package.json` | modify | devDependency electron-builder, script `dist:win` |
| `.gitignore` | modify | Abaikan `dist/` |
| `docs/superpowers/references/2026-10-18-landing-mockup.html` | create | Referensi copy & arah visual yang sudah disetujui |

---

### Task 1: Route group — landing di `/`, editor di `/app`

**Files:**
- Create: `app/(app)/app/page.tsx`, `app/(app)/layout.tsx`, `app/(marketing)/layout.tsx`, `app/(marketing)/page.tsx`
- Modify: `app/layout.tsx`
- Delete: `app/page.tsx`

**Interfaces:**
- Consumes: —
- Produces: route `/` (Task 5 mengisi isinya) dan `/app`; `app/(marketing)/` adalah tempat komponen landing; nama komponen per bagian dipakai Task 5.

- [ ] **Step 1: Pindahkan editor.** Salin isi `app/page.tsx` apa adanya ke `app/(app)/app/page.tsx` (tetap `"use client"`, tetap mengimpor `OnboardingDialog`, `EditorLayout`, `CaptureSourcePicker` dari `@/app/components/...`), lalu hapus `app/page.tsx` dengan `git rm app/page.tsx`.

- [ ] **Step 2: Bungkus grup editor.** `app/(app)/layout.tsx` mengembalikan `<div className="h-dvh overflow-hidden flex flex-col">{children}</div>` — mempertahankan lingkungan layout yang sama seperti body sebelumnya (kedua root editor sudah `h-screen overflow-hidden` sendiri, jadi ini hanya menjaga paritas).

- [ ] **Step 3: Bungkus grup marketing.** `app/(marketing)/layout.tsx` mengembalikan `<div className="min-h-dvh">{children}</div>` dan mengekspor `metadata` landing: `title: "Creator Screen — Layar bersih, siap direkam"`, `description` satu kalimat Bahasa Indonesia tentang overlay kamera/teks/timer di atas konten, lalu merekam.

- [ ] **Step 4: Stub landing.** `app/(marketing)/page.tsx` sementara hanya `<main className="p-10"><h1>Creator Screen</h1></main>` — digantikan penuh di Task 5.

- [ ] **Step 5: Root layout.** Di `app/layout.tsx`: `lang="en"` → `lang="id"`; hapus `h-full overflow-hidden flex flex-col` dari `<body>` (sisakan `min-h-dvh` + `bg-background text-foreground antialiased`) karena landing butuh scroll dokumen normal; **pertahankan** `<Script id="theme-init" strategy="beforeInteractive">` di root (Next mensyaratkan `beforeInteractive` hanya di root layout).

- [ ] **Step 6: Build dan periksa output.**

Run: `pnpm build`
Expected: sukses, dan `out/index.html` serta `out/app.html` ada.

- [ ] **Step 7: Periksa isi output rute.**

Run: `grep -c "creator-screen-onboarding" out/app.html out/index.html`
Expected: `out/app.html` ≥ 1, `out/index.html` = 0 (editor tidak ikut di halaman marketing).

- [ ] **Step 8: Periksa script tema masih sebelum konten editor.**

Run: `grep -c "creator-screen-theme" out/app.html` dan periksa posisinya di `out/app.html`.
Expected: ≥ 1, dan `theme-init` muncul sebelum markup editor (tidak ada kedipan tema).

- [ ] **Step 9: Uji statis + tipe + lint.**

Run: `pnpm test && npx tsc --noEmit && pnpm lint`
Expected: test hijau; tsc bersih; lint 17 masalah (tidak bertambah).

- [ ] **Step 10: Commit.**

```bash
git add -A "app/layout.tsx" "app/(app)" "app/(marketing)"
git rm --cached app/page.tsx 2>/dev/null || true
git commit -m "refactor(routes): landing at /, editor at /app"
```

---

### Task 2: Aplikasi desktop memuat `/app`

**Files:**
- Modify: `electron/main.js:138`

**Interfaces:**
- Consumes: route `/app` dari Task 1.
- Produces: rute asar `app://bundle/app.html` yang diverifikasi Task 6.

- [ ] **Step 1: Ubah URL.**

`mainWindow.loadURL("app://bundle/index.html")` → `mainWindow.loadURL("app://bundle/app.html")`.

- [ ] **Step 2: Jalankan aplikasi prod dengan profil terpisah dan CDP.**

Run: `electron.exe . --prod --remote-debugging-port=9261 --user-data-dir=<temp>`
Expected: jendela memuat editor — `document.title` tidak kosong, elemen editor ada, `typeof window.creatorScreen === "object"`, dan tidak ada error console.

- [ ] **Step 3: Uji unit tetap hijau.**

Run: `pnpm test`
Expected: 30/30.

- [ ] **Step 4: Commit.**

```bash
git add electron/main.js
git commit -m "feat(electron): load the editor from /app after the route split"
```

---

### Task 3: Identitas brand — token, marka, favicon, ikon aplikasi

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `app/lib/mark.json`, `app/(marketing)/components/brand-mark.tsx`, `scripts/brand/build-assets.mjs`, `app/icon.svg` (hasil skrip), `build/icon.ico`, `build/icon.png`

**Interfaces:**
- Consumes: —
- Produces: utility Tailwind `bg-ink`, `bg-ink-2`, `bg-paper`, `bg-paper-2`, `border-line`, `bg-accent`, `text-accent-ink`, `text-muted-ink`, `font-display` (dipakai Task 5); komponen `BrandMark({ size, className, ring })` (dipakai Task 5); `build/icon.ico` (dipakai Task 6).

- [ ] **Step 1: Tambahkan token brand** ke blok `@theme inline` di `app/globals.css`, memetakan ke custom property di `:root` dengan nilai persis dari spec §6.3: `--color-ink: oklch(0.19 0.02 250)`, `--color-ink-2: oklch(0.26 0.022 250)`, `--color-paper: oklch(0.972 0.008 90)`, `--color-paper-2: oklch(0.995 0.005 90)`, `--color-line: oklch(0.86 0.012 90)`, `--color-accent: oklch(0.62 0.2 30)`, `--color-accent-ink: oklch(0.5 0.17 28)`, `--color-muted-ink: oklch(0.52 0.014 250)`, dan `--font-display: var(--font-display)` mengikuti pola `--font-sans` yang sudah ada.

- [ ] **Step 2: Tambahkan font display** di `app/layout.tsx` dengan `Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], display: "swap" })` dan sertakan variabelnya di `className` `<html>` bersama `manrope.variable`.

- [ ] **Step 3: Buat `app/lib/mark.json`** berisi geometri tunggal marka: `viewBox: "0 0 40 40"`, bingkai `{ x: 2.5, y: 4.5, w: 31, h: 23, rx: 5, strokeWidth: 3.2 }`, kartu `{ x: 22, y: 17, w: 16, h: 15, rx: 4, strokeWidth: 2.6 }`, dan warna `{ accent: "oklch(0.62 0.2 30)", ink: "oklch(0.19 0.02 250)", paper: "oklch(0.972 0.008 90)" }`.

- [ ] **Step 4: Buat `brand-mark.tsx`** yang mengimpor `mark.json`: bingkai memakai `stroke="currentColor"` (agar mengikuti konteks terang/gelap), kartu memakai `fill` aksen dengan `stroke` warna `ring` (prop, default `paper`) sebagai pemisah. Props: `size` (number, default 26), `className`, `ring`.

- [ ] **Step 5: Buat `scripts/brand/build-assets.mjs`** yang membaca `mark.json` dan menulis: `app/icon.svg` (ubin persegi rounded latar `ink`, bingkai `paper`, kartu `accent` — dipakai juga sebagai favicon) dan `build/icon.png`, lalu merender ubin itu lewat Electron pada 16/24/32/48/64/128/256 px dan menyusunnya menjadi `build/icon.ico` (container ICO: header 6 byte + satu direktori per gambar + payload PNG). Skrip tidak menambah dependency baru.

- [ ] **Step 6: Jalankan skrip aset.**

Run: `node scripts/brand/build-assets.mjs`
Expected: `app/icon.svg`, `build/icon.png`, `build/icon.ico` tertulis; skrip melaporkan jumlah gambar di dalam ICO.

- [ ] **Step 7: Periksa struktur ICO secara terprogram** (bukan dengan mata): byte 0–1 `00 00`, byte 2–3 `01 00`, byte 4–5 = jumlah gambar, dan tiap direktori menunjuk offset yang valid.

- [ ] **Step 8: Build dan periksa token + favicon ikut terkirim.**

Run: `pnpm build` lalu cek `out/icon.svg` ada dan grep `--color-accent` pada CSS di `out/_next/static/css/`.
Expected: favicon ada; token aksen ada di CSS hasil build.

- [ ] **Step 9: Commit.**

```bash
git add app/globals.css app/layout.tsx app/lib/mark.json "app/(marketing)/components/brand-mark.tsx" app/icon.svg build scripts/brand
git commit -m "feat(brand): landing tokens, brand mark and generated windows icon"
```

---

### Task 4: Tangkapan layar asli (kamera sintetis + jendela demo)

**Files:**
- Create: `scripts/screenshots/demo-stage.html`, `scripts/screenshots/capture.mjs`, `public/landing/hero.webp`, `public/landing/editor.webp`, `public/landing/scenes.webp`, `public/landing/saved.webp`

**Interfaces:**
- Consumes: route `/app` (Task 1) dan `app://bundle/app.html` (Task 2).
- Produces: empat berkas gambar dengan nama persis di atas (dirujuk `app/lib/landing-content.ts` di Task 5).

- [ ] **Step 1: Buat `demo-stage.html`** — halaman konten demo yang aman dipublikasikan: potongan kode asli dari repo ini ditampilkan dalam panel bergaya editor (bukan gambar orang, bukan isi desktop pemilik mesin), dengan judul halaman yang mudah dikenali picker.

- [ ] **Step 2: Buat `capture.mjs`** yang: (a) membuka jendela demo lewat Edge app-mode (`--app=file://.../demo-stage.html --window-size=1280,720`), (b) menjalankan aplikasi `--prod --remote-debugging-port=<port> --user-data-dir=<temp> --use-fake-device-for-media-stream`, (c) lewat CDP memilih jendela demo sebagai sumber, menyalakan kamera, menaruh overlay teks/timer, (d) mengambil `Page.captureScreenshot` format `webp` quality 82 ke `public/landing/`: `hero` 2560×1440, `editor`/`scenes`/`saved` 1600×1200.

- [ ] **Step 3: Jalankan pengambilan gambar.**

Run: `node scripts/screenshots/capture.mjs`
Expected: empat berkas `.webp` tertulis, masing-masing > 20 KB.

- [ ] **Step 4: Periksa gambar satu per satu** (buka berkasnya) dan laporkan apa yang terlihat: (a) tidak ada wajah manusia, (b) tidak ada isi desktop pemilik mesin, (c) komposisi terbaca sebagai produk. Kalau ada yang gagal, perbaiki langkah 2 dan ulangi — jangan pernah mengganti gambar dengan ilustrasi bikinan.

- [ ] **Step 5: Commit.**

```bash
git add scripts/screenshots public/landing
git commit -m "feat(assets): capture real app screenshots with a synthetic camera"
```

---

### Task 5: Landing page

**Files:**
- Create: `app/lib/download.ts`, `app/lib/landing-content.ts`, `app/(marketing)/page.tsx`, `app/(marketing)/components/{landing-nav,landing-hero,landing-why,landing-features,landing-steps,landing-gallery,landing-faq,landing-footer,download-button}.tsx`, `scripts/serve-out.mjs`, `docs/superpowers/references/2026-10-18-landing-mockup.html`
- Modify: `app/(marketing)/layout.tsx`, `package.json` (script `serve:out`)

**Interfaces:**
- Consumes: token + `BrandMark` (Task 3), `public/landing/*.webp` (Task 4).
- Produces: `WINDOWS_INSTALLER` di `app/lib/download.ts` dengan bentuk `{ version: string; url: string; ready: boolean }` (Task 7 mengubah nilainya menjadi `ready: true` + URL rilis nyata).

- [ ] **Step 1: Salin mockup yang disetujui** ke `docs/superpowers/references/2026-10-18-landing-mockup.html` (dari `%TEMP%\opencode\landing-mockup\index.html`, tanpa skrip diagnostik) sebagai referensi copy & arah visual. Semua teks di langkah-langkah berikut diambil persis dari berkas ini.

- [ ] **Step 2: Buat `app/lib/download.ts`** dengan nilai awal yang jujur: `version: "0.1.0"`, `url: ""`, `ready: false` (URL belum ada; mengarang ukuran/versi dilarang).

- [ ] **Step 3: Buat `app/lib/landing-content.ts`** berisi `FEATURES` (6 item: tag mono, judul, deskripsi), `STEPS` (3), `FAQ` (6 pertanyaan + jawaban), `GALLERY` (3 item: src, caption, alt) — teks dari mockup, gambar dari `public/landing/`.

- [ ] **Step 4: Buat `download-button.tsx`** yang merender: kalau `ready` → `<a href={url}>` "Download untuk Windows"; kalau belum → yang dirender adalah catatan jujur "Installer Windows sedang disiapkan — segera tersedia." **tanpa** tautan mati dan **tanpa** ukuran/versi. Varian tampilan (solid di atas tinta, solid di panel penutup) lewat prop.

- [ ] **Step 5: Buat komponen bagian** (`landing-nav`, `landing-hero`, `landing-why`, `landing-features`, `landing-steps`, `landing-gallery`, `landing-faq`, `landing-footer`) memakai utility token dari Task 3, `BrandMark`, gambar asli, dan `details/summary` untuk FAQ. Tanpa `useState`/`useEffect` di mana pun (harus tetap Server Component). Heading utama persis: **"Layar bersih, siap direkam."**; label hero: **"Gratis · Windows 10/11"**; CTA sekunder: **"Coba di browser"** menuju `/app`.

- [ ] **Step 6: Susun `/`** di `app/(marketing)/page.tsx` dengan urutan: Nav → Hero → Kenapa dibuat → Fitur → Cara pakai → Tangkapan layar → FAQ → CTA penutup → Footer. Footer menuliskan "Creator Screen — dibuat oleh Chelution."

- [ ] **Step 7: Latar marketing.** Di `app/(marketing)/layout.tsx`, beri pembungkus `bg-paper text-ink` supaya review focus #2 (preferensi gelap editor) tidak menjalar ke landing.

- [ ] **Step 8: Build.**

Run: `pnpm build`
Expected: sukses; `out/index.html` berisi teks hero; `out/app.html` tidak berubah isinya (editor).

- [ ] **Step 9: Buat `scripts/serve-out.mjs`** yang menyajikan `out/` dan memetakan permintaan tanpa ekstensi ke berkas `.html` (`/` → `index.html`, `/app` → `app.html`) — meniru `_redirects` di host supaya rute bisa diuji lokal. Tambahkan script `"serve:out": "node scripts/serve-out.mjs out 8901"` di `package.json`.

Run: `pnpm build && pnpm serve:out`
Expected: `/` menampilkan landing, `/app` menampilkan editor.

- [ ] **Step 10: Probe CDP pada hasil build** dan pastikan: heading `Layar bersih, siap direkam.` ada; 6 kartu fitur; 3 langkah; 6 item FAQ; 3 gambar termuat (`naturalWidth > 0`); 0 error console; `document.querySelectorAll("a[href='/app']").length > 0`.

- [ ] **Step 11: Periksa overflow dan tema** (Review Focus 1, 2, 3): jalankan pengambilan gambar pada 360/768/1440 px dan pastikan `scrollWidth === clientWidth`; set `localStorage["creator-screen-theme"]="dark"` lalu muat `/` dan pastikan latar tetap terang; muat `/app` langsung (bukan lewat navigasi klien) dan pastikan editor tampil.

- [ ] **Step 12: Uji statis + tipe + lint, lalu commit.**

```bash
pnpm test && npx tsc --noEmit && pnpm lint
git add app "docs/superpowers/references" scripts/serve-out.mjs package.json
git commit -m "feat(landing): bahasa indonesia landing page at /"
```

---

### Task 6: Installer Windows

**Files:**
- Create: `electron-builder.yml`, `dist/CreatorScreen-Setup-0.1.0.exe` (hasil, tidak di-commit)
- Modify: `package.json`, `.gitignore`, `electron/main.js` (hanya bila loader `app://` perlu diganti)

**Interfaces:**
- Consumes: `build/icon.ico` (Task 3), `app://bundle/app.html` (Task 2).
- Produces: `dist/CreatorScreen-Setup-0.1.0.exe` (diunggah Task 7).

- [ ] **Step 1: Tambah devDependency** `electron-builder` (`pnpm add -D electron-builder`) dan tambahkan `.gitignore`: `dist/`.

- [ ] **Step 2: Tambah script** `"dist:win": "pnpm build && electron-builder --win --x64"` di `package.json`.

- [ ] **Step 3: Buat `electron-builder.yml`** dengan nilai persis: `appId: com.chelution.creatorscreen`, `productName: Creator Screen`, `directories.output: dist`, `files: ["electron/**/*", "out/**/*", "package.json", "!**/*.test.js", "!node_modules/**/*"]`, `win: { target: [{ target: nsis, arch: [x64] }], icon: build/icon.ico }`, `nsis: { oneClick: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, shortcutName: Creator Screen, artifactName: CreatorScreen-Setup-${version}.${ext} }`. `!node_modules/**/*` wajib: proses main tidak butuh dependency runtime sama sekali, dan tanpa pengecualian itu installer membengkak ratusan MB.

- [ ] **Step 4: Build installer.**

Run: `pnpm dist:win`
Expected: `dist/CreatorScreen-Setup-0.1.0.exe` dan `dist/win-unpacked/Creator Screen.exe` ada; ukuran installer wajar (< 150 MB). Kalau jauh lebih besar, periksa kembali langkah 3 sebelum lanjut.

- [ ] **Step 5: Jalankan build packaged** (`dist/win-unpacked/Creator Screen.exe`, profil terpisah, CDP) dan pastikan editor termuat dari dalam asar: judul terisi, `typeof window.creatorScreen === "object"`, 0 error console, tidak layar putih. **Review Focus #4.**

- [ ] **Step 6: Kalau langkah 5 gagal** karena `app://` tidak bisa membaca berkas di dalam asar, ganti loader yang disuntikkan di `electron/main.js` dari `net.fetch(pathToFileURL(...))` menjadi pembaca berbasis `fs.promises.readFile` yang mengembalikan `Response` — `electron/protocol.js` tidak diubah, dan uji unitnya tetap hijau. Jalankan ulang langkah 5.

- [ ] **Step 7: Regresi rekam di build packaged**: kamera → Select screen → Record → Stop → dialog "Simpan rekaman" → berkas `.mp4` benar-benar ada dan tidak ada `<uuid>.tmp` baru di folder Downloads.

- [ ] **Step 8: Minta izin ke human partner sebelum menjalankan installer** (ini memasang program di komputernya). Kalau diizinkan: jalankan `dist/CreatorScreen-Setup-0.1.0.exe`, selesaikan pemasangan, buka aplikasi dari shortcut, dan pastikan editor tampil. Kalau tidak diizinkan: catat di ledger bahwa pemasangan belum diuji, dan jangan mengklaim sebaliknya.

- [ ] **Step 9: Commit.**

```bash
git add package.json pnpm-lock.yaml .gitignore electron-builder.yml electron/main.js
git commit -m "build(electron): nsis installer with a brand icon"
```

---

### Task 7: Terbitkan installer dan hidupkan tombol Download

**Files:**
- Modify: `app/lib/download.ts`

**Interfaces:**
- Consumes: `dist/CreatorScreen-Setup-0.1.0.exe` (Task 6).
- Produces: URL aset rilis yang benar-benar mengembalikan 200, dipakai landing.

- [ ] **Step 1: Periksa autentikasi GitHub.**

Run: `gh auth status`
Expected: login sebagai pemilik repo. Kalau belum login, **berhenti**: minta human partner menjalankan `gh auth login`, lalu lanjut. Jangan mengunggah apa pun tanpa autentikasi yang jelas.

- [ ] **Step 2: Terbitkan release** dari tag `v0.1.0` dengan aset installer, catatan rilis singkat Bahasa Indonesia (menyebut: gratis, Windows 10/11, belum ditandatangani sehingga muncul peringatan SmartScreen).

Run: `gh release create v0.1.0 dist/CreatorScreen-Setup-0.1.0.exe --title "Creator Screen 0.1.0" --notes-file <catatan>`

- [ ] **Step 3: Buktikan URL aset hidup.**

Run: `curl -sIL "<asset url>"` dan periksa status akhir 200 serta `content-length` yang sama dengan ukuran berkas di `dist/`.
Expected: 200 + panjang sama. Kalau tidak, perbaiki URL sebelum menulisnya ke kode.

- [ ] **Step 4: Isi `app/lib/download.ts`** dengan `version: "0.1.0"`, `url` aset dari langkah 3, `ready: true`.

- [ ] **Step 5: Build dan periksa tombolnya aktif.**

Run: `pnpm build`; lalu grep `out/index.html` untuk `releases/download` (harus ada) dan untuk teks "sedang disiapkan" (harus tidak ada).

- [ ] **Step 6: Commit.**

```bash
git add app/lib/download.ts
git commit -m "feat(landing): point the download button at the published release"
```

---

### Task 8: Deploy + situs live

**Files:**
- Create: `public/_redirects`, `public/robots.txt`, `app/opengraph-image.png` (hasil tangkapan) atau `public/og.png` + metadata

**Interfaces:**
- Consumes: build landing (Task 5), URL rilis (Task 7).
- Produces: situs live di `creator.chelution.com` (atau `<project>.pages.dev` sampai DNS diarahkan).

- [ ] **Step 1: Buat `public/_redirects`** berisi tepat `/app /app.html 200`, dan `public/robots.txt` yang mengizinkan semua crawler.

- [ ] **Step 2: Buat gambar pratinjau tautan** 1200×630 dari hero landing yang sudah dibangun (tangkapan asli, bukan komposisi karangan). Periksa di `out/` apakah Next memancarkan `og:image`; kalau konvensinya tidak jalan pada static export, tambahkan `openGraph.images` eksplisit di metadata landing.

- [ ] **Step 3: Build dan periksa aset deploy.**

Run: `pnpm build` lalu pastikan `out/_redirects`, `out/robots.txt`, dan gambar pratinjau ada di `out/`.

- [ ] **Step 4: Deploy.** Tanyakan pilihan ke human partner: (a) hubungkan repo di dashboard Cloudflare Pages (build `pnpm build`, output `out`, `NODE_VERSION=22`) — saya siapkan langkahnya, atau (b) saya jalankan `npx wrangler pages deploy out` setelah mereka `wrangler login`. Jangan menebak kredensial siapa pun.

- [ ] **Step 5: Periksa situs live** (Review Focus #3 di lingkungan sebenarnya): `/` menampilkan landing, `/app` menampilkan editor saat dibuka langsung, tombol Download mengembalikan berkas installer, dan tidak ada error console.

- [ ] **Step 6: DNS.** Tuliskan instruksi persis untuk `creator.chelution.com` (CNAME ke `<project>.pages.dev`, proxy aktif) sebagai langkah manual human partner, lalu verifikasi dengan `curl -sI https://creator.chelution.com/` setelah mereka mengerjakannya.

- [ ] **Step 7: Commit.**

```bash
git add public app
git commit -m "chore(deploy): cloudflare pages redirects, robots and link preview"
```

---

### Task 9: Sapuan verifikasi akhir

- [ ] **Step 1: Jalankan seluruh perintah verifikasi dan catat keluarannya apa adanya.**

Run: `pnpm test && npx tsc --noEmit && pnpm lint && pnpm build`
Expected: test hijau; tsc bersih; lint ≤ 17 masalah; build sukses. Laporkan angka sebenarnya, bukan "seharusnya".

- [ ] **Step 2: Periksa ulang Review Focus satu per satu** dan tuliskan buktinya (bukan klaim): 360 px tanpa scroll horizontal; `/` tetap terang meski localStorage gelap; `/app` hidup saat deep link; aplikasi packaged memuat editor dari asar; tombol Download menghasilkan installer yang terpasang.

- [ ] **Step 3: Tulis ringkasan ke ledger** `.superpowers/sdd/2026-10-18-landing-page/progress.md`: keputusan, bukti, dan apa pun yang belum terverifikasi (mis. pemasangan installer kalau human partner menolak).

- [ ] **Step 4: Commit sisa perubahan** (kalau ada) dan laporkan ke human partner: apa yang sudah jalan, apa yang belum, dan langkah manual yang tersisa (DNS).

---

## Catatan pelaksanaan

- **Urutan wajib** untuk bagian yang saling bergantung: Task 1 → 2 (rute), 3 → 5 (token & marka), 4 → 5 (gambar), 6 → 7 → 8 (rilis & deploy). Task 3 dan 4 bisa berjalan sebelum/paralel dengan 5 selama kontrak namanya dijaga.
- **Verifikasi tanpa menebak**: setiap klaim di laporan akhir harus punya keluaran perintah atau tangkapan layar pendukung. Kalau sesuatu tidak diuji, tulis "belum diuji".
- **Jangan sentuh** aplikasi milik human partner yang sedang jalan, dan jangan pernah `Stop-Process -Name electron` secara global.
- **Probe harus memakai profil terpisah** (`--user-data-dir=<temp>`) dan port debugging unik, lalu matikan hanya proses dengan port itu.
- **Screenshot**: bila ada satu saja yang membocorkan isi layar pemilik mesin atau wajah orang, hapus berkasnya dan ulangi pengambilan.
