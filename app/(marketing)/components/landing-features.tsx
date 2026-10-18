import { FEATURES } from "@/app/lib/landing-content";

/** Six claims, each one something the shipped app can actually do. */
export default function LandingFeatures() {
    return (
        <section id="fitur" className="scroll-mt-[66px] py-[clamp(56px,8vw,92px)]">
            <div className="mx-auto w-full max-w-[1140px] px-[clamp(20px,5vw,48px)]">
                <div className="max-w-[60ch]">
                    <p className="mb-3.5 font-mono text-[0.72rem] tracking-[0.14em] text-brand-ink uppercase">
                        Fitur
                    </p>
                    <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.7rem)] leading-[1.03] font-bold tracking-[-0.03em] text-balance">
                        Yang benar-benar ada di dalam aplikasi.
                    </h2>
                    <p className="mt-4 text-[1.03rem] text-muted-ink">
                        Semua di bawah ini bisa Anda pakai di versi gratis. Tidak
                        ada fitur yang dikunci.
                    </p>
                </div>
                <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(288px,1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line">
                    {FEATURES.map((feature) => (
                        <div
                            key={feature.title}
                            className="bg-paper-2 px-6 pt-[26px] pb-[30px]"
                        >
                            <p className="mb-3 font-mono text-[0.72rem] tracking-[0.14em] text-brand-ink uppercase">
                                {feature.tag}
                            </p>
                            <h3 className="mb-2 font-display text-[1.22rem] leading-[1.25] font-semibold tracking-[-0.02em]">
                                {feature.title}
                            </h3>
                            <p className="text-[0.95rem] text-muted-ink">
                                {feature.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
