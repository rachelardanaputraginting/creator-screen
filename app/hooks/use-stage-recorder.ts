"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIME_FALLBACK = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "",
];

function safeSupported(mime: string) {
    if (mime === "") return true;
    try {
        return MediaRecorder.isTypeSupported(mime);
    } catch {
        return false;
    }
}

interface StageRecorderArgs {
    micStream: MediaStream | null;
}

interface ActiveRecording {
    timer: ReturnType<typeof setInterval>;
    ownedTracks: MediaStreamTrack[];
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
    ownFullscreen: boolean;
}

function pad(n: number) {
    return String(n).padStart(2, "0");
}

function fileNameFor(date: Date) {
    return `creator-screen-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.webm`;
}

export function useStageRecorder({ micStream }: StageRecorderArgs): {
    status: "idle" | "recording";
    elapsedMs: number;
    error: string | null;
    notice: string | null;
    blobUrl: string | null;
    fileName: string;
    start: () => void;
    stop: () => Blob | null;
    clearError: () => void;
    clearNotice: () => void;
} {
    const [status, setStatus] = useState<"idle" | "recording">("idle");
    const [elapsedMs, setElapsedMs] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState("creator-screen.webm");
    const recRef = useRef<ActiveRecording | null>(null);
    const blobRef = useRef<Blob | null>(null);

    const stopOwnedTracks = useCallback((rec: ActiveRecording) => {
        rec.ownedTracks.forEach((t) => {
            try {
                t.stop();
            } catch {
                /* already stopped */
            }
        });
    }, []);

    const teardown = useCallback(
        (rec: ActiveRecording) => {
            clearInterval(rec.timer);
            try {
                if (rec.recorder.state !== "inactive") rec.recorder.stop();
            } catch {
                /* already stopped */
            }
            stopOwnedTracks(rec);
        },
        [stopOwnedTracks],
    );

    const start = useCallback(async () => {
        if (recRef.current) return;
        if (typeof MediaRecorder === "undefined") {
            setError("Browser tidak mendukung perekaman video.");
            return;
        }
        if (
            !navigator.mediaDevices?.getDisplayMedia ||
            typeof document === "undefined"
        ) {
            setError(
                "Berbagi layar tidak didukung di browser ini. Gunakan Chrome/Edge terbaru di desktop.",
            );
            return;
        }

        const ownFullscreen = !document.fullscreenElement;
        try {
            await document.documentElement.requestFullscreen();
        } catch {
            /* lanjut tanpa fullscreen */
        }

        let shareStream: MediaStream;
        try {
            shareStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
        } catch (e) {
            const name =
                e instanceof DOMException
                    ? e.name
                    : (e as { name?: string } | null)?.name;
            if (name === "NotAllowedError" || name === "AbortError") {
                return;
            }
            setError("Gagal memulai berbagi layar.");
            return;
        }

        const [track] = shareStream.getVideoTracks();
        if (!track) {
            shareStream.getTracks().forEach((t) => t.stop());
            setError("Gagal memulai berbagi layar.");
            return;
        }
        if (track.getSettings().displaySurface !== "monitor") {
            shareStream.getTracks().forEach((t) => t.stop());
            setError("Pilih Entire Screen, bukan tab/window.");
            return;
        }

        setError(null);
        setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        blobRef.current = null;
        setElapsedMs(0);

        const mime = MIME_FALLBACK.find((m) => safeSupported(m));
        if (mime === undefined) {
            shareStream.getTracks().forEach((t) => t.stop());
            setError("Browser tidak mendukung perekaman video.");
            return;
        }

        const micTracks =
            micStream
                ?.getAudioTracks()
                .filter((t) => t.readyState === "live") ?? [];
        const recordStream =
            micTracks.length > 0
                ? new MediaStream([track, ...micTracks])
                : new MediaStream([track]);

        const chunks: Blob[] = [];
        let recorder: MediaRecorder;
        try {
            recorder =
                mime === ""
                    ? new MediaRecorder(recordStream)
                    : new MediaRecorder(recordStream, {
                          mimeType: mime,
                          videoBitsPerSecond: 8_000_000,
                      });
        } catch {
            setError("Browser tidak mendukung perekaman video.");
            track.stop();
            return;
        }

        const startedAt = Date.now();
        const rec: ActiveRecording = {
            timer: setInterval(() => setElapsedMs(Date.now() - startedAt), 500),
            ownedTracks: [track],
            recorder,
            chunks,
            startedAt,
            ownFullscreen,
        };
        recRef.current = rec;

        track.onended = () => {
            if (recRef.current === rec) {
                try {
                    if (recorder.state !== "inactive") recorder.stop();
                } catch {
                    /* noop */
                }
                setNotice(
                    "Berbagi layar berhenti — rekaman parsial tersimpan, silakan download.",
                );
            }
        };
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
            const active = recRef.current === rec;
            clearInterval(rec.timer);
            stopOwnedTracks(rec);
            if (active) {
                const blob = new Blob(chunks, { type: "video/webm" });
                blobRef.current = blob;
                setBlobUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(blob);
                });
                setFileName(fileNameFor(new Date()));
                setStatus("idle");
                recRef.current = null;
            }
        };

        try {
            recorder.start(250);
        } catch {
            teardown(rec);
            recRef.current = null;
            setError("Gagal memulai perekaman.");
            return;
        }
        setStatus("recording");
    }, [micStream, teardown, stopOwnedTracks]);

    const stop = useCallback(() => {
        const rec = recRef.current;
        if (!rec) return blobRef.current;
        try {
            if (rec.recorder.state !== "inactive") rec.recorder.stop();
            else {
                clearInterval(rec.timer);
                stopOwnedTracks(rec);
                recRef.current = null;
                setStatus("idle");
            }
        } catch {
            clearInterval(rec.timer);
            stopOwnedTracks(rec);
            recRef.current = null;
            setStatus("idle");
        }
        if (rec.ownFullscreen && document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
        }
        return null;
    }, [stopOwnedTracks]);

    const clearError = useCallback(() => setError(null), []);
    const clearNotice = useCallback(() => setNotice(null), []);

    useEffect(
        () => () => {
            const rec = recRef.current;
            if (rec) {
                clearInterval(rec.timer);
                try {
                    if (rec.recorder.state !== "inactive") rec.recorder.stop();
                } catch {
                    /* noop */
                }
                stopOwnedTracks(rec);
                recRef.current = null;
            }
            setBlobUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        },
        [stopOwnedTracks],
    );

    return {
        status,
        elapsedMs,
        error,
        notice,
        blobUrl,
        fileName,
        start,
        stop,
        clearError,
        clearNotice,
    };
}
