import Image from "next/image";
import { GALLERY } from "@/app/lib/landing-content";

/**
 * Three captures taken from the running app (see
 * `scripts/screenshots/capture.mjs`). Captions describe what is actually in
 * each frame - no shot is illustrated, and none of them shows anyone's desktop
 * or face: the camera feed is Chromium's synthetic test pattern.
 */
export default function LandingGallery() {
    return (
        <section
            id="tangkapan"
            className="scroll-mt-[66px] py-[clamp(56px,8vw,92px)]"
        >
            <div className="mx-auto w-full max-w-[1140px] px-[clamp(20px,5vw,48px)]">
                <div className="max-w-[60ch]">
                    <p className="mb-3.5 font-mono text-[0.72rem] tracking-[0.14em] text-brand-ink uppercase">
                        Tangkapan layar
                    </p>
                    <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.7rem)] leading-[1.03] font-bold tracking-[-0.03em] text-balance">
                        Ini tampilan aslinya.
                    </h2>
                    <p className="mt-4 text-[1.03rem] text-muted-ink">
                        Diambil langsung dari aplikasi, bukan ilustrasi.
                    </p>
                </div>
                <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[18px]">
                    {GALLERY.map((shot) => (
                        <figure key={shot.src} className="m-0">
                            <Image
                                src={shot.src}
                                alt={shot.alt}
                                width={1600}
                                height={1200}
                                className="w-full rounded-[14px] border border-line"
                            />
                            <figcaption className="mt-3 text-[0.92rem] text-muted-ink">
                                <b className="font-semibold text-ink">
                                    {shot.lead}
                                </b>{" "}
                                {shot.caption}
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </div>
        </section>
    );
}
