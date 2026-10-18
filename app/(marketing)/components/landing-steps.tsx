import { STEPS } from "@/app/lib/landing-content";

/** Three numbered steps on the paper-2 band. */
export default function LandingSteps() {
    return (
        <section
            id="cara-pakai"
            className="scroll-mt-[66px] border-y border-line bg-paper-2 py-[clamp(56px,8vw,92px)]"
        >
            <div className="mx-auto w-full max-w-[1140px] px-[clamp(20px,5vw,48px)]">
                <div className="max-w-[60ch]">
                    <p className="mb-3.5 font-mono text-[0.72rem] tracking-[0.14em] text-brand-ink uppercase">
                        Cara pakai
                    </p>
                    <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.7rem)] leading-[1.03] font-bold tracking-[-0.03em] text-balance">
                        Tiga langkah, lalu rekam.
                    </h2>
                </div>
                <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-7">
                    {STEPS.map((step, index) => (
                        <div key={step.title} className="relative pt-[46px]">
                            <span
                                aria-hidden="true"
                                className="absolute top-0 left-0 font-display text-[1.9rem] font-bold tracking-[-0.04em] text-brand"
                            >
                                {`0${index + 1}`}
                            </span>
                            <h3 className="mb-2 font-display text-[1.22rem] leading-[1.25] font-semibold tracking-[-0.02em]">
                                {step.title}
                            </h3>
                            <p className="text-[0.95rem] text-muted-ink">
                                {step.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
