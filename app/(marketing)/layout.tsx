import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Creator Screen — Layar bersih, siap direkam",
    description:
        "Aplikasi Windows gratis untuk menyusun layar rekaman: konten utama di tengah, kartu profil dan kamera di sampingnya, empat scene siap pakai, lalu satu tombol untuk merekam satu berkas video.",
    twitter: { card: "summary_large_image" },
};

/**
 * The marketing route group paints itself: `bg-paper text-ink` overrides the
 * document colours, so a visitor whose editor theme preference is dark still
 * gets a light landing page (the theme script only adds `.dark`, it never
 * removes the marketing background).
 */
export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className="min-h-dvh bg-paper text-ink">{children}</div>;
}
