"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// MP4 (H.264 + AAC) lebih friendly — langsung bisa diputar di semua
// device. Chrome/Edge/Safari mendukung rekam MP4 via MediaRecorder;
// Firefox jatuh ke WebM.
const MIME_FALLBACK = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
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

type Container = "mp4" | "webm";

function containerOf(mime: string): Container {
    return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

interface StageRecorderArgs {
    micStream: MediaStream | null;
    screenStreamRef: { current: MediaStream | null };
}

interface ActiveRecording {
    timer: ReturnType<typeof setInterval>;
    ownedTracks: MediaStreamTrack[];
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
    ownFullscreen: boolean;
    audioCtx: AudioContext | null;
    mixNodes: AudioNode[];
}

function pad(n: number) {
    return String(n).padStart(2, "0");
}

function fileNameFor(date: Date, container: Container) {
    return `creator-screen-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.${container}`;
}

export function useStageRecorder({
    micStream,
    screenStreamRef,
}: StageRecorderArgs): {
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
            if (rec.audioCtx && rec.audioCtx.state !== "closed") {
                void rec.audioCtx.close().catch(() => {});
            }
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
        // requestFullscreen HARUS dipanggil sebelum picker getDisplayMedia:
        // setelah dialog picker, transient user gesture browser (~5 detik)
        // sudah kedaluwarsa sehingga fullscreen ditolak diam-diam dan
        // rekaman jadi ukuran window biasa.
        const enterOwnFullscreen = async () => {
            if (!ownFullscreen) return;
            try {
                await document.documentElement.requestFullscreen();
            } catch {
                /* lanjut tanpa fullscreen */
            }
        };
        const leaveOwnFullscreen = () => {
            if (ownFullscreen && document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
            }
        };

        await enterOwnFullscreen();

        window.creatorScreen?.setCapturePurpose("record");

        let shareStream: MediaStream;
        try {
            shareStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
                selfBrowserSurface: "include",
                preferCurrentTab: true,
                surfaceSwitching: "exclude",
            } as DisplayMediaStreamOptions);
        } catch (e) {
            leaveOwnFullscreen();
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
            leaveOwnFullscreen();
            setError("Gagal memulai berbagi layar.");
            return;
        }
        if (
            !window.creatorScreen?.isElectron &&
            track.getSettings().displaySurface !== "browser"
        ) {
            shareStream.getTracks().forEach((t) => t.stop());
            leaveOwnFullscreen();
            setError("Pilih Browser Tab ini (tab Creator Screen), bukan Entire Screen/window.");
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
            leaveOwnFullscreen();
            setError("Browser tidak mendukung perekaman video.");
            return;
        }

        const micTracks =
            micStream
                ?.getAudioTracks()
                .filter((t) => t.readyState === "live") ?? [];
        const systemTracks =
            screenStreamRef.current
                ?.getAudioTracks()
                .filter((t) => t.readyState === "live") ?? [];
        const audioSources = [...systemTracks, ...micTracks];

        // Single source: append directly (no AudioContext needed). Two or more
        // sources (system audio + mic) must be mixed down — MediaRecorder only
        // records the first audio track of a stream.
        let audioCtx: AudioContext | null = null;
        let mixNodes: AudioNode[] = [];
        let audioTracks: MediaStreamTrack[] = [];
        if (audioSources.length === 1) {
            audioTracks = audioSources;
        } else if (audioSources.length > 1) {
            try {
                audioCtx = new AudioContext();
                if (audioCtx.state === "suspended") {
                    await audioCtx.resume().catch(() => {});
                }
                const dest = audioCtx.createMediaStreamDestination();
                for (const source of audioSources) {
                    const node = audioCtx.createMediaStreamSource(
                        new MediaStream([source]),
                    );
                    node.connect(dest);
                    mixNodes.push(node);
                }
                audioTracks = dest.stream.getAudioTracks();
            } catch {
                void audioCtx?.close().catch(() => {});
                audioCtx = null;
                mixNodes = [];
                audioTracks = micTracks.length > 0 ? micTracks : systemTracks;
            }
        }
        const recordStream = new MediaStream([track, ...audioTracks]);

        const chunks: Blob[] = [];
        let container: Container = containerOf(mime);
        const makeRecorder = (mimeType: string): MediaRecorder | null => {
            try {
                return mimeType === ""
                    ? new MediaRecorder(recordStream)
                    : new MediaRecorder(recordStream, {
                          mimeType,
                          videoBitsPerSecond: 8_000_000,
                      });
            } catch {
                return null;
            }
        };
        const recorder = makeRecorder(mime);
        if (!recorder) {
            void audioCtx?.close().catch(() => {});
            leaveOwnFullscreen();
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
            audioCtx,
            mixNodes,
        };
        recRef.current = rec;

        // Handler dipasang per-recorder; hanya recorder yang aktif di `rec`
        // yang boleh menyumbang chunk / finalisasi (penting saat fallback
        // menukar recorder di tengah jalan).
        const attachRecorderHandlers = (r: MediaRecorder) => {
            r.ondataavailable = (e) => {
                if (rec.recorder === r && e.data && e.data.size > 0)
                    chunks.push(e.data);
            };
            r.onerror = () => {
                if (rec.recorder !== r || recRef.current !== rec) return;
                if (!mime.startsWith("video/mp4")) return;
                // Encoder H.264 Chrome bisa gagal di layar resolusi tinggi
                // (Retina/200% scaling) — rekam ulang dengan WebM di stream
                // yang sama. Chunk MP4 yang gagal dibuang supaya tidak
                // tercampur dengan WebM.
                chunks.length = 0;
                container = "webm";
                setNotice(
                    "Encoder MP4 gagal di browser ini — rekaman dilanjutkan dengan WebM.",
                );
                const fallback =
                    makeRecorder("video/webm;codecs=vp9,opus") ??
                    makeRecorder("video/webm");
                if (!fallback) return;
                rec.recorder = fallback;
                attachRecorderHandlers(fallback);
                try {
                    fallback.start(250);
                } catch {
                    /* noop */
                }
            };
            r.onstop = () => {
                if (rec.recorder !== r) return;
                if (rec.audioCtx && rec.audioCtx.state !== "closed") {
                    void rec.audioCtx.close().catch(() => {});
                }
                const active = recRef.current === rec;
                clearInterval(rec.timer);
                stopOwnedTracks(rec);
                if (active) {
                    const blob = new Blob(chunks, {
                        type:
                            container === "mp4" ? "video/mp4" : "video/webm",
                    });
                    blobRef.current = blob;
                    setBlobUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return URL.createObjectURL(blob);
                    });
                    setFileName(fileNameFor(new Date(), container));
                    setStatus("idle");
                    recRef.current = null;
                }
            };
        };
        attachRecorderHandlers(recorder);

        track.onended = () => {
            if (recRef.current === rec) {
                try {
                    if (rec.recorder.state !== "inactive") rec.recorder.stop();
                } catch {
                    /* noop */
                }
                setNotice(
                    "Berbagi layar berhenti — rekaman parsial tersimpan, silakan download.",
                );
            }
        };

        try {
            recorder.start(250);
        } catch {
            teardown(rec);
            recRef.current = null;
            leaveOwnFullscreen();
            setError("Gagal memulai perekaman.");
            return;
        }
        setStatus("recording");
    }, [micStream, screenStreamRef, teardown, stopOwnedTracks]);

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
                if (rec.audioCtx && rec.audioCtx.state !== "closed") {
                    void rec.audioCtx.close().catch(() => {});
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
