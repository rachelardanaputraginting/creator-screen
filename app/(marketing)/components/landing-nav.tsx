import { SECTIONS } from "@/app/lib/landing-content";
import BrandMark from "./brand-mark";
import DownloadButton from "./download-button";

/** Sticky bar on top of the dark hero stage. */
export default function LandingNav() {
    return (
        <header
            id="top"
            className="sticky top-0 z-20 border-b border-paper/15 bg-ink/92 backdrop-blur-[10px]"
        >
            <div className="mx-auto flex h-[66px] w-full max-w-[1140px] items-center gap-3.5 px-[clamp(20px,5vw,48px)] text-paper min-[521px]:gap-7">
                <a
                    href="#top"
                    className="mr-auto flex items-center gap-2.5 font-display text-[1.06rem] font-bold tracking-[-0.02em] no-underline"
                >
                    <BrandMark size={27} />
                    Creator Screen
                </a>
                <nav className="hidden gap-[22px] text-[0.9rem] min-[881px]:flex">
                    {SECTIONS.map((section) => (
                        <a
                            key={section.href}
                            href={section.href}
                            className="text-paper/70 no-underline transition-colors hover:text-paper"
                        >
                            {section.label}
                        </a>
                    ))}
                </nav>
                <DownloadButton size="sm" />
            </div>
        </header>
    );
}
