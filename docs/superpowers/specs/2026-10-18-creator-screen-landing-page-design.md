# Landing Page + Distribusi Windows — Design

- Date: 2026-10-18
- Status: approved (arah visual & lingkup disetujui oleh human partner)
- Mockup referensi: `%TEMP%\opencode\landing-mockup\index.html` (bukan bagian dari repo)

## 1. Context

Creator Screen sekarang hanya bisa dijangkau orang yang tahu cara menjalankan
proyeknya: `app/page.tsx` adalah editornya, dan build Windows-nya belum ada.
Produknya mau dipakai orang banyak dan dipublikasikan di `creator.chelution.com`.

Kondisi yang relevan:

- Next.js 16.3.6 dengan `output: "export"` → `out/`, tanpa server.
- Aplikasi desktop (Electron 44.9.0) memuat `app://bundle/index.html`, yaitu
  route `/` — route yang sama yang mau dijadikan halaman marketing.
- Repo belum punya identitas brand: `public/` hanya SVG bawaan create-next-app,
  palet editor netral (shadcn base-nova), tanpa logo atau ikon.
- Belum ada cara distribusi: tidak ada `electron-builder`, tidak ada installer.
- `gh` CLI 2.93.0 terpasang; repo `github.com/rachelardanaputraginting/creator-screen`.

### Decision

Halaman marketing masuk ke aplikasi ini juga: `/` menjadi landing page, dan
editor pindah ke `/app`. Distribusinya lewat installer Windows (NSIS) yang
diunggah ke GitHub Releases, dan situsnya di-deploy statis ke Cloudflare Pages.

## 2. Goal and success criteria

**Goal.** Siapa pun yang membuka `creator.chelution.com` bisa memahami produknya
dalam hitungan detik, lalu mengunduh dan memasang aplikasi Windows-nya sampai
bisa merekam MP4 — tanpa akun, tanpa penjelasan tambahan dari kita.

**Success criteria.**

1. `creator.chelution.com/` menampilkan landing page dalam Bahasa Indonesia,
   ter-render statis, tanpa error console, tanpa overflow di 360/768/1440 px.
2. `creator.chelution.com/app` membuka editor yang perilakunya **tidak berubah**
   dari hari ini (onboarding, share screen, kamera/mik, Record → Simpan MP4).
3. Aplikasi desktop tetap memuat editor yang sama dan seluruh alur rekam lulus
   regresi, baik dari `out/` maupun dari installer yang sudah dipasang.
4. Tombol Download menghasilkan installer yang benar-benar bisa dipasang dan
   menjalankan aplikasi (diuji di mesin ini).
5. Semua isi halaman jujur: tidak ada angka, kuota, testimoni, atau tangkapan
   layar yang dikarang. Setiap gambar berasal dari aplikasi yang berjalan.
6. `pnpm test`, `tsc --noEmit`, `pnpm lint`, dan `pnpm build` tetap bersih
   (lint: jumlah masalah tidak bertambah dari 17 yang sudah ada).

## 3. Non-goals (versi ini)

- Build macOS/Linux; code signing berbayar; auto-update (`electron-updater`).
- Pembayaran, lisensi, aktivasi, akun pengguna (model: gratis).
- Versi Bahasa Inggris / i18n, blog, CMS, newsletter, analytics.
- Restyle editor. Editor hanya berubah rutenya, bukan tampilannya.
- Installer MSI atau portable ZIP.

## 4. Key decisions

| Keputusan | Alasan | Konsekuensi kalau salah |
|---|---|---|
| Landing di `/`, editor di `/app` | Satu codebase, satu build, satu deploy; brand & komponen app dipakai ulang | Editor harus diuji ulang, dan rute Electron ikut berubah |
| Installer NSIS dari `electron-builder`, bukan tarball manual | Installer standar Windows, ada shortcut & uninstaller | Menambah devDependency + konfigurasi packaging |
| Artefak installer di GitHub Releases, bukan di repo | Installer ±90 MB; Cloudflare Pages punya batas ukuran file | Perlu akun GitHub yang sudah login untuk publikasi |
| Identitas visual dirancang dari nol | Repo belum punya brand; gaya default AI akan meleburkan identitas produk | Perlu review arah visual (sudah dilakukan lewat mockup) |
| Screenshot diambil dari aplikasi asli dengan kamera pola-uji sintetis | Halaman butuh gambar nyata, tapi wajah orang tidak boleh terpublikasi tanpa izin | Gambar terlihat seperti kartu uji, bukan wajah creator |
| Sumber konten di screenshot = jendela demo yang saya buka sendiri | Menghindari mempublikasikan isi layar/desktop pemilik mesin | Perlu satu jendela demo ekstra saat pengambilan gambar |
| Teks jujur: tanpa angka karangan | Kepercayaan calon pengguna | Halaman sedikit lebih "sepi" sampai datanya nyata |
| Installer tidak ditandatangani | Sertifikat code signing berbayar | Windows menampilkan peringatan SmartScreen; ditulis apa adanya di FAQ |

## 5. Architecture

```text
creator.chelution.com  (Cloudflare Pages, statis dari out/)
  /            → app/(marketing)/page.tsx      landing page, Server Component
  /app         → app/(app)/app/page.tsx        editor (client), perilaku sama
  /app.html    → hasil export; di-rewrite oleh public/_redirects

Aplikasi desktop (Electron)
  app://bundle/app.html  → editor yang sama, diserve dari out/ (asar saat packaged)

Distribusi
  GitHub Release vX.Y.Z  →  CreatorScreen-Setup-X.Y.Z.exe
        ▲                                   │
        │ upload (gh release)               │ download
   electron-builder                      tombol Download di landing
   (dist/CreatorScreen-Setup-X.Y.Z.exe)  (URL dari app/lib/download.ts)
```

Prinsip yang dipertahankan dari pekerjaan sebelumnya: logika yang bisa diuji
tidak mengimpor `electron`; akses ke shell hanya lewat `window.creatorScreen`;
perilaku browser tidak boleh berubah.

## 6. Components

### 6.1 Rute dan layout

| File | Aksi | Tanggung jawab |
|------|------|----------------|
| `app/layout.tsx` | modify | `<html lang="id">` + dua font sebagai CSS variable (`--font-sans` Manrope, `--font-display` Bricolage Grotesque). Script tema tetap di sini. |
| `app/(marketing)/layout.tsx` | create | Metadata landing + pembungkus `bg-paper text-ink` |
| `app/(marketing)/page.tsx` | create | Landing page (Server Component) |
| `app/(app)/app/page.tsx` | create | Isi `app/page.tsx` yang sekarang (editor, client) |
| `app/(app)/layout.tsx` | create | Pembungkus `h-dvh overflow-hidden` untuk grup editor |
| `app/page.tsx` | delete | Digantikan route marketing |

Script init tema **tetap di root layout**: `next/script` dengan
`strategy="beforeInteractive"` hanya sah dipakai di root layout, jadi
memindahkannya ke grup `(app)` akan mengubah cara tema diterapkan sebelum
hidrasi. Sebagai gantinya, halaman marketing memakai pembungkusnya sendiri
dengan latar `--color-paper`, sehingga preferensi gelap milik editor tidak
terlihat di landing (diuji di Task 5, Review Focus #2).

### 6.2 Landing page

Server Component murni — tanpa state klien. Elemen interaktif memakai
`<details>`/anchor sehingga tidak perlu JavaScript tambahan. Struktur bagian:

1. Nav: marka + kata kunci + tautan Fitur/Cara pakai/Tangkapan layar/FAQ + tombol Download.
2. Hero "panggung" gelap: label `Gratis · Windows 10/11`, H1 "Layar bersih, siap direkam.",
   paragraf penjelas, tombol Download (ikon Windows) + tautan sekunder "Coba di browser" → `/app`,
   catatan kecil, dan tangkapan layar aplikasi.
3. Kenapa dibuat: tiga kolom "cara lama" → "akibatnya" → "dengan Creator Screen".
4. Fitur: enam kartu yang semuanya nyata (sumber layar/jendela/wilayah, overlay
   kamera/teks/gambar/timer/keystroke, scene siap pakai, mode presentasi, rekam MP4,
   pengaturan tersimpan otomatis + undo/redo + pintasan).
5. Cara pakai: tiga langkah bernomor.
6. Tangkapan layar: tiga gambar asli + caption yang cocok dengan isi gambarnya.
7. FAQ: gratis?, versi Windows?, kenapa ada peringatan Windows?, perlu akun/internet?,
   rekaman disimpan di mana?, bisa tanpa instal?
8. CTA penutup + footer ("Creator Screen — dibuat oleh Chelution").

**Aturan isi:** setiap klaim harus bisa dibuktikan dari aplikasi/PRD. Ukuran file,
jumlah pengguna, dan testimoni tidak dicantumkan sampai datanya nyata.

### 6.3 Identitas visual

Token ditambahkan ke blok `@theme inline` di `app/globals.css` supaya menjadi
utility Tailwind (`bg-ink`, `text-paper`, `bg-accent`, `font-display`):

| Token | Nilai | Peran |
|---|---|---|
| `--color-ink` | `oklch(0.19 0.02 250)` | Latar "panggung" |
| `--color-ink-2` | `oklch(0.26 0.022 250)` | Panel di atas tinta |
| `--color-paper` | `oklch(0.972 0.008 90)` | Latar utama |
| `--color-paper-2` | `oklch(0.995 0.005 90)` | Kartu |
| `--color-line` | `oklch(0.86 0.012 90)` | Garis pemisah |
| `--color-accent` | `oklch(0.62 0.2 30)` | Satu-satunya aksen (merah REC) |
| `--color-accent-ink` | `oklch(0.5 0.17 28)` | Aksen untuk teks/hover |
| `--font-display` | Bricolage Grotesque | Judul |

**Dilarang** (mengikuti disiplin anti-AI-slop): gradien ungu, emoji sebagai ikon,
kartu rounded + border kiri berwarna, ilustrasi manusia bikinan, statistik
karangan, foto stok, dan lebih dari satu aksen. Detail tipografi yang dipakai:
`text-wrap: balance`/`pretty`, tanda kutip melengkung, satu animasi masuk saja
yang menghormati `prefers-reduced-motion`.

**Marka** — SVG "bingkai layar + kartu kamera yang keluar dari bingkai", dipakai
untuk: logo di nav/footer, `app/icon.svg` (favicon), dan `build/icon.ico`
(ikon installer & aplikasi).

### 6.4 Konfigurasi download

`app/lib/download.ts` menjadi satu-satunya sumber kebenaran:

```ts
export const WINDOWS_INSTALLER = {
  version: "0.1.0",
  url: "https://github.com/rachelardanaputraginting/creator-screen/releases/download/v0.1.0/CreatorScreen-Setup-0.1.0.exe",
  ready: true, // tetap false sampai URL di atas terbukti mengembalikan 200
};
```

Tombol Download hanya menjadi tautan kalau `ready` bernilai `true`; selama belum,
yang tampil adalah catatan jujur "Installer Windows sedang disiapkan" — bukan
tautan mati, dan tanpa ukuran atau versi karangan. Label versi/ukuran hanya
ditampilkan kalau nilainya nyata.

### 6.5 Packaging (installer)

- `electron-builder` sebagai devDependency, konfigurasi di `electron-builder.yml`.
- `appId: com.chelution.creatorscreen`, `productName: Creator Screen`.
- `files`: `electron/**`, `out/**`, `package.json` (test tidak ikut).
- Target `win` / `nsis`, `x64`, `artifactName: CreatorScreen-Setup-${version}.${ext}`,
  `oneClick: false`, `allowToChangeInstallationDirectory: true`, shortcut desktop + start menu.
- Ikon dari `build/icon.ico`, dibuat oleh `scripts/build-icon.mjs` (menjalankan
  Electron untuk merender marka di beberapa ukuran, lalu menyusun container ICO —
  tanpa dependency tambahan).
- `electron/main.js` diarahkan memuat `app://bundle/app.html`.

### 6.6 Deploy

- `public/_redirects` berisi `/app /app.html 200` supaya `/app` bekerja di
  Cloudflare Pages maupun Netlify tanpa bergantung pada perilaku host.
- Cloudflare Pages: build `pnpm build`, output `out`, Node 22.
- Domain: `creator.chelution.com` → CNAME ke `<project>.pages.dev` (langkah manual
  oleh human partner; saya siapkan instruksinya).
- `app/robots.txt` (via `app/robots.ts`) sederhana, mengizinkan semua.

## 7. Data flow

**Unduh.** Pengunjung → landing → tombol Download → URL GitHub Releases →
`CreatorScreen-Setup-X.Y.Z.exe` → dipasang → aplikasi membaca editor dari asar.

**Rilis baru.** Naikkan `version` → `pnpm build` → `electron-builder` → upload ke
Release → perbarui `app/lib/download.ts` → deploy. Hanya satu file yang berubah di
sisi situs.

**Rekam (tidak berubah).** Renderer mengirim byte rekaman ke main lewat
`recording:save`; main memakai dialog async + `fs.writeFile`. Perubahan rute tidak
menyentuh jalur ini.

## 8. Testing and verification

| Lapis | Cara |
|---|---|
| Logika Electron | `pnpm test` (`node --test`) tetap hijau |
| Tipe & lint | `tsc --noEmit`, `pnpm lint` (tidak menambah masalah) |
| Rute | `pnpm build` menghasilkan `out/index.html` dan `out/app.html`; landing tidak memuat bundel editor |
| Landing (browser) | CDP pada instance Chromium terpisah: judul/heading ada, 0 error console, tidak ada overflow di 360/768/1440 px |
| Editor (browser) | CDP: `/app` menampilkan onboarding/editor seperti sebelumnya |
| Regresi rekam | Instance aplikasi prod terpisah: kamera → share → Record → Stop → dialog "Simpan rekaman" → file `.mp4` benar, tanpa `<uuid>.tmp` |
| Aplikasi desktop | Muat `app://bundle/app.html` dari `out/` |
| Paket | Jalankan `dist/win-unpacked/Creator Screen.exe` (editor tampil, rekam jalan), lalu jalankan installer |
| Visual | Tangkapan layar landing di tiga lebar, diperiksa satu per satu |

Karena repo ini tidak punya harness test renderer, verifikasi UI dilakukan dengan
probe CDP, sama seperti perbaikan-perbaikan sebelumnya.

## 9. Error handling

- **`/app` diakses tanpa trailing slash / tanpa server**: `_redirects` memberi rewrite;
  kalau host mengabaikannya, pranala internal memakai `/app` dan halaman statis
  `app.html` tetap bisa dibuka langsung.
- **Installer belum dirilis**: tombol Download tidak menampilkan versi/ukuran karangan;
  selama URL belum nyata, tombol disembunyikan/diberi catatan jujur, bukan tautan mati.
- **Peringatan SmartScreen**: dijelaskan di FAQ (langkah "More info → Run anyway").
- **Electron tidak bisa membaca `out/` dari dalam asar**: handler `app://` menyuntikkan
  pembaca file, jadi loader bisa diganti ke `fs.readFile` tanpa mengubah logika rute.
- **Screenshot gagal diambil**: slot gambar tidak diisi gambar palsu; caption
  disesuaikan dengan gambar yang benar-benar ada.

## 10. Risks

| Risiko | Mitigasi |
|---|---|
| `net.fetch(file://…asar)` tidak jalan di build packaged | Uji dengan menjalankan `win-unpacked`; siapkan loader berbasis `fs` (sudah disuntikkan) |
| Preferensi gelap editor menjalar ke landing | Landing dibungkus latar `--color-paper` sendiri; script tema tetap di root layout (lihat §6.1) dan diuji dengan `localStorage` gelap |
| `electron-builder` ikut membundel dependency produksi (installer membengkak) | `files` mengecualikan `node_modules/**` (main process tidak butuh dependency runtime) + batas ukuran installer sebagai syarat lulus |
| Cloudflare Pages menolak berkas besar | Installer tidak pernah masuk repo |
| Screenshot membocorkan isi desktop pemilik mesin | Kamera pola-uji sintetis + jendela demo sendiri, tidak pernah "Entire screen" |
| Peringatan SmartScreen menurunkan kepercayaan | Ditulis jujur di FAQ; sertifikat code signing jadi opsi lanjutan |
| `gh` belum login di mesin ini | Cek `gh auth status` lebih dulu; kalau belum, saya serahkan artefak + langkahnya |

## 11. Future (out of scope now)

Code signing, auto-update, build macOS/Linux, halaman harga/lisensi, versi
Bahasa Inggris, halaman changelog, dan analitik.

## 12. Acceptance

Rencana dianggap selesai kalau success criteria di bagian 2 terbukti dengan
bukti nyata (output perintah, tangkapan layar, dan hasil uji pasang installer),
bukan dengan klaim.
