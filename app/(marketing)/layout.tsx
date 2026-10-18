import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Screen — Layar bersih, siap direkam",
  description:
    "Aplikasi Windows gratis untuk menyusun layar rekaman: konten utama di belakang, kamera, teks, gambar, dan timer mengambang di atasnya. Sekali rekam, jadi satu file MP4.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
