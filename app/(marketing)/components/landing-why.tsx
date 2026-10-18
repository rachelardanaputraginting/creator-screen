const COLUMNS = [
    {
        n: "Cara lama",
        title: "Rekam, rekam lagi, baru edit",
        body: "Layar dan wajah terpisah. Hasilnya digabung belakangan, dan kalau ada yang salah, mulai dari awal.",
        good: false,
    },
    {
        n: "Akibatnya",
        title: "Waktu habis di meja editing",
        body: "Komposisi jadi soal menambal: potongan layar dan wajah disatukan setelah rekaman selesai.",
        good: false,
    },
    {
        n: "Dengan Creator Screen",
        title: "Satu layar, satu tombol",
        body: "Susunannya sudah benar sebelum Anda mulai: konten, kartu profil, dan kamera, siap dalam satu klik.",
        good: true,
    },
];

/** Why the product exists: screen here, face there, editing after. */
export default function LandingWhy() {
    return (
        <section className="py-[clamp(56px,8vw,92px)]">
            <div className="mx-auto w-full max-w-[1140px] px-[clamp(20px,5vw,48px)]">
                <div className="max-w-[60ch]">
                    <p className="mb-3.5 font-mono text-[0.72rem] tracking-[0.14em] text-brand-ink uppercase">
                        Kenapa dibuat
                    </p>
                    <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.7rem)] leading-[1.03] font-bold tracking-[-0.03em] text-balance">
                        Rekam tutorial seharusnya tidak dua kali kerja.
                    </h2>
                    <p className="mt-4 text-[1.03rem] text-muted-ink">
                        Cara yang biasa: rekam layar dengan satu aplikasi, rekam
                        wajah dengan HP, lalu gabungkan semuanya di editor. Tiga
                        langkah, dua berkas, satu sesi editing - untuk sesuatu
                        yang sebenarnya bisa disiapkan sebelum rekaman dimulai.
                    </p>
                </div>
                <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[22px]">
                    {COLUMNS.map((column) => (
                        <div
                            key={column.title}
                            className={`border-t-2 pt-[22px] ${
                                column.good ? "border-brand" : "border-ink"
                            }`}
                        >
                            <span className="font-mono text-[0.72rem] tracking-[0.14em] text-muted-ink uppercase">
                                {column.n}
                            </span>
                            <h3 className="mt-2.5 mb-2 font-display text-[1.22rem] leading-[1.25] font-semibold tracking-[-0.02em]">
                                {column.title}
                            </h3>
                            <p className="text-[0.96rem] text-muted-ink">
                                {column.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
