import { SECTIONS } from "@/app/lib/landing-content";
import BrandMark from "./brand-mark";
import DownloadButton from "./download-button";

/** Closing call to action, on an ink panel. */
export function LandingCta() {
    return (
        <section
            id="download"
            className="scroll-mt-[66px] pb-[clamp(56px,8vw,92px)]"
        >
            <div className="mx-auto w-full max-w-[1140px] px-[clamp(20px,5vw,48px)]">
                <div className="flex flex-wrap items-center justify-between gap-6 rounded-[14px] bg-ink px-[clamp(34px,5vw,56px)] py-[clamp(34px,5vw,56px)] text-paper">
                    <div>
                        <h2 className="max-w-[22ch] font-display text-[clamp(1.75rem,3.6vw,2.7rem)] leading-[1.03] font-bold tracking-[-0.03em] text-balance">
                            Siap merekam layar yang rapi?
                        </h2>
                        <p className="mt-3 text-[0.84rem] text-paper/70">
                            Windows 10/11 · Gratis · Tanpa akun
                        </p>
                    </div>
                    <DownloadButton size="lg" />
                </div>
            </div>
        </section>
    );
}

/**
 * Footer. It carries no "Kontak" or "Privasi" link and no repository link:
 * those pages do not exist and the repository is private, so linking them
 * would ship dead links. What is left are the section anchors, which work.
 */
export default function LandingFooter() {
    return (
        <footer className="pb-14">
            <div className="mx-auto w-full max-w-[1140px] px-[clamp(20px,5vw,48px)]">
                <div className="flex flex-wrap items-center justify-between gap-x-[30px] gap-y-[18px] border-t border-line pt-[26px] text-[0.88rem] text-muted-ink">
                    <div className="flex items-center gap-2.5">
                        <BrandMark size={23} />
                        <span>Creator Screen - dibuat oleh Chelution.</span>
                    </div>
                    <nav className="flex flex-wrap gap-5">
                        {SECTIONS.map((section) => (
                            <a
                                key={section.href}
                                href={section.href}
                                className="no-underline transition-colors hover:text-ink"
                            >
                                {section.label}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>
        </footer>
    );
}
