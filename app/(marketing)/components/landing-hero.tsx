import Image from "next/image";
import DownloadButton from "./download-button";

/**
 * The dark "stage" hero: the pitch on the left, a real capture of the app on
 * the right. The capture is the editor with a shared source and a live camera -
 * taken from the running app, never illustrated.
 */
export default function LandingHero() {
    return (
        <section className="border-b border-paper/15 bg-ink text-paper">
            <div className="mx-auto grid w-full max-w-[1140px] items-center gap-x-[clamp(32px,5vw,64px)] gap-y-10 px-[clamp(20px,5vw,48px)] py-[clamp(56px,9vw,104px)] min-[881px]:grid-cols-[minmax(0,1.02fr)_minmax(0,1.12fr)]">
                <div>
                    <span className="mb-[22px] inline-flex items-center gap-2.5 font-mono text-[0.72rem] tracking-[0.14em] text-paper/70 uppercase">
                        <span
                            aria-hidden="true"
                            className="size-[9px] rounded-full bg-brand shadow-[0_0_0_4px_oklch(0.62_0.2_30/0.22)]"
                        />
                        Gratis · Windows 10/11
                    </span>
                    <h1 className="font-display text-[clamp(2.4rem,6.2vw,4.3rem)] leading-[1.03] font-bold tracking-[-0.03em] text-balance">
                        Layar bersih,
                        <br />
                        siap direkam.
                    </h1>
                    <p className="mt-[22px] max-w-[46ch] text-[clamp(1.02rem,1.5vw,1.16rem)] text-paper/70">
                        Creator Screen menyusun satu layar rekaman: konten utama
                        di tengah, kartu profil dan kamera di sampingnya. Ganti
                        scene sekali klik, tekan Record, jadi satu berkas video.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <DownloadButton />
                        <a
                            href="/app"
                            className="inline-flex items-center rounded-[10px] border border-paper/24 px-5 py-3 text-[0.95rem] font-semibold text-paper no-underline transition-colors hover:bg-ink-2"
                        >
                            Coba di browser
                        </a>
                    </div>
                    <p className="mt-[18px] text-[0.84rem] text-paper/70">
                        Tanpa akun, tanpa langganan. Rekaman tersimpan di folder
                        yang Anda pilih sendiri.
                    </p>
                </div>
                <figure className="m-0">
                    <Image
                        src="/landing/hero.webp"
                        alt="Tangkapan layar Creator Screen: pratinjau jendela yang dibagikan, kartu Kamera & Mic dengan pratinjau langsung, dan tombol Record HD."
                        width={2560}
                        height={1440}
                        priority
                        className="w-full rounded-[14px] border border-paper/12 shadow-2xl"
                    />
                </figure>
            </div>
        </section>
    );
}
