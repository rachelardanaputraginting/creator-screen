import { FAQ } from "@/app/lib/landing-content";

/**
 * Native `<details>` elements: the accordion works without shipping any client
 * JavaScript, which also means the page has no hydration to fail.
 */
export default function LandingFaq() {
    return (
        <section id="faq" className="scroll-mt-[66px] py-[clamp(56px,8vw,92px)]">
            <div className="mx-auto w-full max-w-[1140px] px-[clamp(20px,5vw,48px)]">
                <div className="max-w-[60ch]">
                    <p className="mb-3.5 font-mono text-[0.72rem] tracking-[0.14em] text-brand-ink uppercase">
                        Pertanyaan
                    </p>
                    <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.7rem)] leading-[1.03] font-bold tracking-[-0.03em] text-balance">
                        Yang biasanya ditanyakan.
                    </h2>
                </div>
                <div className="mt-10 border-t border-line">
                    {FAQ.map((item, index) => (
                        <details
                            key={item.question}
                            open={index === 0}
                            className="group border-b border-line"
                        >
                            <summary className="flex cursor-pointer list-none items-center gap-3.5 py-5 font-display text-[1.06rem] font-semibold tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
                                <span
                                    aria-hidden="true"
                                    className="w-3.5 font-mono text-[1rem] text-brand group-open:hidden"
                                >
                                    +
                                </span>
                                <span
                                    aria-hidden="true"
                                    className="hidden w-3.5 font-mono text-[1rem] text-brand group-open:inline"
                                >
                                    −
                                </span>
                                {item.question}
                            </summary>
                            <p className="max-w-[68ch] pb-[22px] pl-7 text-muted-ink">
                                {item.answer}
                            </p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
