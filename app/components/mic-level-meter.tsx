"use client";

import { useEffect, useRef } from "react";

/**
 * Live input-level bar for the active mic stream. The AudioContext and rAF
 * loop only exist while a live stream is passed in — they are torn down the
 * moment the stream goes away (mic off / unmount), keeping idle RAM flat.
 */
export default function MicLevelMeter({
    stream,
}: {
    stream: MediaStream | null;
}) {
    const barRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const track = stream?.getAudioTracks()[0];
        if (!stream || !track || track.readyState !== "live") return;

        let raf = 0;
        let ctx: AudioContext | null = null;
        try {
            ctx = new AudioContext();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            const tick = () => {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                const level = Math.min(1, rms * 5);
                if (barRef.current) {
                    barRef.current.style.transform = `scaleX(${level})`;
                }
                raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        } catch {
            /* meter unavailable — silent fallback */
        }
        return () => {
            cancelAnimationFrame(raf);
            void ctx?.close().catch(() => {});
        };
    }, [stream]);

    return (
        <div
            aria-hidden="true"
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
        >
            <div
                ref={barRef}
                className="h-full w-full origin-left scale-x-0 rounded-full bg-primary"
            />
        </div>
    );
}
