/**
 * The repeated copy of the landing page lives here: the feature grid, the three
 * steps, the FAQ, the gallery captions, and the section anchors. One-off prose
 * stays in its own section component.
 *
 * Honesty rule for this file: a claim only belongs here if the shipped app can
 * actually do it. The PRD lists features that are not implemented yet (region
 * capture, text/image/timer overlays, undo/redo), so they are deliberately not
 * part of the copy. Nothing here may quote a file size, a user count, or a
 * version that does not exist.
 */

/** Section anchors, shared by the nav and the footer so they cannot drift. */
export interface SectionLink {
    href: string;
    label: string;
}

export const SECTIONS: SectionLink[] = [
    { href: "#fitur", label: "Fitur" },
    { href: "#cara-pakai", label: "Cara pakai" },
    { href: "#tangkapan", label: "Tangkapan layar" },
    { href: "#faq", label: "FAQ" },
];

export interface Feature {
    /** Small mono label above the title. */
    tag: string;
    title: string;
    body: string;
}

export const FEATURES: Feature[] = [
    {
        tag: "Sumber",
        title: "Layar penuh atau satu jendela",
        body: "Pilih seluruh layar atau satu jendela aplikasi tertentu dari daftar yang sudah menampilkan pratinjaunya.",
    },
    {
        tag: "Kamera & mic",
        title: "Pratinjau sebelum merekam",
        body: "Nyalakan kamera dengan tombol mirror, pilih perangkat mic, dan lihat level suaranya lebih dulu.",
    },
    {
        tag: "Scene",
        title: "Empat tata letak siap pakai",
        body: "Coding, Browser, Terminal, dan Presentasi. Tiap scene menyimpan sumber dan pengaturan perangkatnya sendiri.",
    },
    {
        tag: "Presentasi",
        title: "Mode layar penuh",
        body: "Panel editor hilang; tinggal konten, kartu profil, dan kamera memenuhi layar - siap dilihat audiens.",
    },
    {
        tag: "Rekam",
        title: "Sekali tekan, satu berkas",
        body: "Layar dan kamera masuk ke satu berkas video. Anda yang menentukan folder dan nama berkasnya saat menekan Stop.",
    },
    {
        tag: "Kenyamanan",
        title: "Susunan tersimpan sendiri",
        body: "Sumber, scene, dan pengaturan perangkat disimpan di perangkat Anda. Pintasan: Ctrl+1–4 ganti scene, Ctrl+Shift+F layar penuh, Esc berhenti.",
    },
];

export interface Step {
    title: string;
    body: string;
}

export const STEPS: Step[] = [
    {
        title: "Pilih sumber",
        body: "Seluruh layar atau satu jendela aplikasi, dipilih dari daftar yang menampilkan pratinjau tiap sumber.",
    },
    {
        title: "Nyalakan kamera & mic",
        body: "Pratinjau kamera, tombol mirror, pemilihan perangkat mic, dan level suara - lengkap sebelum Anda mulai.",
    },
    {
        title: "Rekam atau presentasi",
        body: "Tekan Record untuk menghasilkan satu berkas video, atau masuk mode presentasi kalau rekamannya dari perangkat lain.",
    },
];

export interface FaqItem {
    question: string;
    answer: string;
}

export const FAQ: FaqItem[] = [
    {
        question: "Apakah benar-benar gratis?",
        answer: "Ya. Tidak ada akun, tidak ada langganan, dan tidak ada batas jumlah rekaman.",
    },
    {
        question: "Windows versi berapa yang didukung?",
        answer: "Windows 10 dan 11 (64-bit). Versi macOS dan Linux belum tersedia.",
    },
    {
        question: "Saat dipasang muncul peringatan dari Windows, kenapa?",
        answer: "Installer-nya belum ditandatangani sertifikat digital berbayar, jadi Windows menampilkan peringatan yang sama seperti aplikasi baru pada umumnya. Klik “More info”, lalu “Run anyway”.",
    },
    {
        question: "Perlu internet atau akun untuk memakainya?",
        answer: "Tidak. Aplikasi berjalan sendiri di komputer Anda; tidak ada data yang dikirim ke mana pun.",
    },
    {
        question: "Rekamannya disimpan di mana?",
        answer: "Di folder yang Anda pilih saat menekan Stop. Format utamanya MP4; kalau MP4 tidak didukung, aplikasi memberi tahu dan melanjutkan dengan WebM.",
    },
    {
        question: "Bisa dicoba tanpa instal?",
        answer: "Bisa - halaman ini juga jalan di browser. Bedanya: pemilihan sumber memakai dialog bawaan browser, dan berkasnya disimpan lewat unduhan browser, bukan dialog simpan aplikasi.",
    },
];

export interface GalleryShot {
    src: string;
    alt: string;
    /** Bold lead-in of the caption, e.g. "Editor." */
    lead: string;
    /** The sentence that follows the lead-in. */
    caption: string;
}

export const GALLERY: GalleryShot[] = [
    {
        src: "/landing/editor.webp",
        alt: "Editor Creator Screen: pratinjau sumber di tengah, kartu profil dan kamera di panel kanan, tombol Record HD di bawah.",
        lead: "Editor.",
        caption:
            "Semua panel dalam satu layar: sumber, kamera, dan pengaturan.",
    },
    {
        src: "/landing/scenes.webp",
        alt: "Editor Creator Screen dengan scene Browser aktif; tab Coding, Browser, dan Terminal ada di atas pratinjau.",
        lead: "Scene.",
        caption: "Ganti susunan tanpa menata ulang.",
    },
    {
        src: "/landing/recording.webp",
        alt: "Creator Screen saat merekam: badge REC dengan waktu berjalan dan tombol Stop, kamera tetap tampil di panel kanan.",
        lead: "Rekam.",
        caption:
            "Badge waktu dan tombol Stop ada di panel yang sama; hasilnya satu berkas video.",
    },
];
