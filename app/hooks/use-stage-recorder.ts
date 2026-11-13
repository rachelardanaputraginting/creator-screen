"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CreatorScreenBridge } from "@/types/bridge";

const isLinux =
    (typeof window !== "undefined" &&
        window.creatorScreen?.platform === "linux") ||
    (typeof navigator !== "undefined" &&
        /linux/i.test(navigator.userAgent || ""));

// Format video fallback: WebM di Linux, MP4 di Windows/macOS dengan fallback ke WebM
const MIME_FALLBACK = isLinux
    ? [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4;codecs=avc1,mp4a.40.2",
          "video/mp4",
          "",
      ]
    : [
          "video/mp4;codecs=avc1,mp4a.40.2",
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
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
    return mime.includes("mp4") ? "mp4" : "webm";
}

function pad(n: number) {
    return String(n).padStart(2, "0");
}

function fileNameFor(date: Date, container: Container) {
    return `creator-screen-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.${container}`;
}

/**
 * The native recorder, when this build has one.
 *
 * On Linux WebKitGTK hands display capture frames to the renderer from GPU
 * memory: the preview plays, but MediaRecorder encodes 0 bytes and canvas
 * readback is black. The backend records through the portal + GStreamer
 * instead, which is the only path that produces a real file here.
 */
function nativeBridge(): CreatorScreenBridge | null {
    if (typeof window === "undefined") return null;
    const bridge = window.creatorScreen;
    if (!bridge?.isDesktop || bridge.platform !== "linux") return null;
    if (typeof bridge.startScreenRecording !== "function") return null;
    if (typeof bridge.stopScreenRecording !== "function") return null;
    return bridge;
}

export interface StageRecorderArgs {
    micStream: MediaStream | null;
    /** Friendly device label of the selected mic (e.g. "Headset Microphone").
     *  The Web Audio-processed stream's own track label is unreliable. */
    micLabel?: string | null;
    screenStreamRef: React.RefObject<MediaStream | null> | { current: MediaStream | null };
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

interface ActiveNativeRecording {
    timer: ReturnType<typeof setInterval>;
    startedAt: number;
}

export function useStageRecorder({
    micStream,
    micLabel,
    screenStreamRef,
}: StageRecorderArgs): {
    status: "idle" | "recording";
    elapsedMs: number;
    error: string | null;
    notice: string | null;
    blobUrl: string | null;
    /** Finished native recording still in the app cache, waiting to be saved. */
    filePath: string | null;
    fileBytes: number | null;
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
    const [filePath, setFilePath] = useState<string | null>(null);
    const [fileBytes, setFileBytes] = useState<number | null>(null);
    const [fileName, setFileName] = useState("creator-screen.webm");
    const recRef = useRef<ActiveRecording | null>(null);
    const nativeRef = useRef<ActiveNativeRecording | null>(null);
    const finishingRef = useRef(false);
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

    /** Finish a native recording and publish the file it produced. */
    const finalizeNative = useCallback(async () => {
        const bridge = nativeBridge();
        const active = nativeRef.current;
        if (!bridge || !active || finishingRef.current) return;

        finishingRef.current = true;
        clearInterval(active.timer);
        nativeRef.current = null;

        try {
            const result = await bridge.stopScreenRecording!();
            setStatus("idle");
            if (result.error) {
                setError(`Gagal menyelesaikan rekaman: ${result.error}`);
                return;
            }
            if (!result.path || !result.bytes) {
                setError(
                    "Rekaman kosong (0 byte). Pastikan panggung menampilkan konten saat merekam.",
                );
                return;
            }
            setFileName(fileNameFor(new Date(), "webm"));
            setFileBytes(result.bytes);
            setFilePath(result.path);
        } finally {
            finishingRef.current = false;
        }
    }, []);

    const startNative = useCallback(async () => {
        const bridge = nativeBridge();
        if (!bridge) return;

        setError(null);
        setNotice(null);
        setFilePath(null);
        setFileBytes(null);
        setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        blobRef.current = null;
        setElapsedMs(0);

        const liveMicTrack = (micStream?.getAudioTracks() ?? []).find(
            (t) => t.readyState === "live",
        );
        const withMic = !!liveMicTrack;

        const result = await bridge.startScreenRecording!(
            withMic,
            micLabel || liveMicTrack?.label || null,
        );
        if (!result.ok) {
            // A dismissed portal dialog is a cancel, not a failure.
            if (!result.canceled) {
                setError(
                    result.error || "Gagal memulai perekaman layar aplikasi.",
                );
            }
            return;
        }

        const startedAt = Date.now();
        const timer = setInterval(() => {
            setElapsedMs(Date.now() - startedAt);
        }, 250);
        nativeRef.current = { timer, startedAt };
        setStatus("recording");
    }, [micStream, micLabel]);

    const start = useCallback(async () => {
        if (recRef.current || nativeRef.current) return;

        if (nativeBridge()) {
            await startNative();
            return;
        }

        if (typeof MediaRecorder === "undefined") {
            setError("Browser tidak mendukung perekaman video.");
            return;
        }
        if (
            !navigator.mediaDevices?.getDisplayMedia ||
            typeof document === "undefined"
        ) {
            setError("Perekaman layar tidak didukung di environment ini.");
            return;
        }

        const isDesktop =
            typeof window !== "undefined" && !!window.creatorScreen?.isDesktop;
        const ownFullscreen = !document.fullscreenElement && !isDesktop;
        const enterOwnFullscreen = () => {
            if (!ownFullscreen) return;
            try {
                void document.documentElement.requestFullscreen().catch(() => {});
            } catch {
                /* lanjut tanpa fullscreen */
            }
        };
        const leaveOwnFullscreen = () => {
            if (ownFullscreen && document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
            }
        };

        window.creatorScreen?.setCapturePurpose("record");

        // Tangkap aktivitas Creator Screen (seluruh panggung/aplikasi).
        // Gunakan { video: true } murni tanpa constraint max/min atau audio: false.
        // Di WebKitGTK / browser modern getDisplayMedia melarang modifier max/min dan audio: false
        // (melempar TypeError / OverconstrainedError "Invalid constraint").
        // video: true menangkap resolusi native layar secara penuh tanpa batasan.
        let shareStream: MediaStream;
        try {
            enterOwnFullscreen();
            shareStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
            });
        } catch (err) {
            leaveOwnFullscreen();
            const name =
                err instanceof DOMException
                    ? err.name
                    : (err as { name?: string } | null)?.name || "";
            if (
                name === "NotAllowedError" ||
                name === "AbortError" ||
                name === "SecurityError" ||
                name === "PermissionDeniedError"
            ) {
                return;
            }
            const msg = err instanceof Error ? err.message : String(err || "");
            setError(
                msg
                    ? `Gagal memulai perekaman layar aplikasi: ${msg}`
                    : "Gagal memulai perekaman layar aplikasi.",
            );
            return;
        }

        const [videoTrack] = shareStream.getVideoTracks();
        if (!videoTrack) {
            shareStream.getTracks().forEach((t) => t.stop());
            leaveOwnFullscreen();
            setError("Tidak ada video track yang diterima untuk direkam.");
            return;
        }

        setError(null);
        setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        blobRef.current = null;
        setElapsedMs(0);

        const mime = MIME_FALLBACK.find((m) => safeSupported(m)) ?? "";

        // Kumpulkan audio: suara tab/aplikasi yang direkam + mic presenter + suara source screen aktif
        const displayAudioTracks = shareStream
            .getAudioTracks()
            .filter((t) => t.readyState === "live");
        const screenAudioTracks = (
            screenStreamRef.current?.getAudioTracks() ?? []
        ).filter((t) => t.readyState === "live");
        const micAudioTracks = (micStream?.getAudioTracks() ?? []).filter(
            (t) => t.readyState === "live",
        );

        const allAudioSources: MediaStreamTrack[] = [...displayAudioTracks];
        for (const t of screenAudioTracks) {
            if (!allAudioSources.some((s) => s.id === t.id)) {
                allAudioSources.push(t);
            }
        }
        for (const t of micAudioTracks) {
            if (!allAudioSources.some((s) => s.id === t.id)) {
                allAudioSources.push(t);
            }
        }

        let audioCtx: AudioContext | null = null;
        const mixNodes: AudioNode[] = [];
        let finalAudioTracks: MediaStreamTrack[] = [];

        if (allAudioSources.length === 1) {
            finalAudioTracks = allAudioSources;
        } else if (allAudioSources.length > 1) {
            try {
                audioCtx = new AudioContext();
                if (audioCtx.state === "suspended") {
                    await audioCtx.resume().catch(() => {});
                }
                const dest = audioCtx.createMediaStreamDestination();
                for (const track of allAudioSources) {
                    const src = audioCtx.createMediaStreamSource(
                        new MediaStream([track]),
                    );
                    src.connect(dest);
                    mixNodes.push(src);
                }
                finalAudioTracks = dest.stream.getAudioTracks();
            } catch (e) {
                console.error("Audio mixing failed, using primary audio track", e);
                finalAudioTracks = allAudioSources.slice(0, 1);
            }
        }

        const combinedStream = new MediaStream([
            videoTrack,
            ...finalAudioTracks,
        ]);

        const chunks: Blob[] = [];
        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(combinedStream, {
                mimeType: mime || undefined,
                videoBitsPerSecond: 8_000_000,
            });
        } catch {
            recorder = new MediaRecorder(combinedStream);
        }

        const rec: ActiveRecording = {
            timer: setInterval(() => {
                setElapsedMs(Date.now() - rec.startedAt);
            }, 250),
            // Only tracks this hook created may be stopped on teardown. The mic
            // and the scene's screen audio belong to the editor: stopping those
            // switched the microphone off right after every recording and
            // showed a bogus "Mic berhenti" notice.
            ownedTracks: [
                videoTrack,
                ...displayAudioTracks,
                ...(mixNodes.length > 0 ? finalAudioTracks : []),
            ],
            recorder,
            chunks,
            startedAt: Date.now(),
            ownFullscreen,
            audioCtx,
            mixNodes,
        };
        recRef.current = rec;

        const isCurrent = () => recRef.current === rec;

        const handleData = (e: BlobEvent) => {
            if (isCurrent() && e.data && e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        // Publish whatever was recorded. Reads the container from the recorder
        // that actually produced the bytes: after an MP4 → WebM fallback the
        // original recorder still reports MP4, and naming WebM bytes `.mp4`
        // produced a file no desktop player would open.
        const handleStop = () => {
            const active = isCurrent();
            clearInterval(rec.timer);
            stopOwnedTracks(rec);
            if (rec.audioCtx && rec.audioCtx.state !== "closed") {
                void rec.audioCtx.close().catch(() => {});
            }
            if (rec.ownFullscreen && document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
            }

            if (active) {
                const actualMime =
                    rec.recorder.mimeType || recorder.mimeType || mime;
                const finalContainer = containerOf(actualMime);
                const blob = new Blob(chunks, {
                    type:
                        finalContainer === "mp4"
                            ? "video/mp4"
                            : "video/webm",
                });
                blobRef.current = blob;
                setBlobUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(blob);
                });
                setFileName(fileNameFor(new Date(), finalContainer));
                setStatus("idle");
                recRef.current = null;
            }
        };

        recorder.ondataavailable = handleData;
        recorder.onstop = handleStop;

        recorder.onerror = () => {
            if (!isCurrent()) return;

            if (!mime.startsWith("video/mp4")) {
                setError("Encoder video gagal. Rekaman dihentikan.");
                try {
                    if (rec.recorder.state !== "inactive") rec.recorder.stop();
                } catch {
                    /* already stopped */
                }
                return;
            }

            // MP4 encoder gagal di perangkat ini: buang chunk MP4 yang tidak
            // lengkap, lalu lanjutkan dengan WebM supaya hasil yang tersimpan
            // tetap utuh dan bisa diputar. The failed recorder must not
            // publish its empty chunk list, so detach its stop handler first.
            chunks.length = 0;
            recorder.onstop = null;
            try {
                if (recorder.state !== "inactive") recorder.stop();
            } catch {
                /* already stopped */
            }

            const fallbackMime =
                MIME_FALLBACK.find(
                    (m) => m.startsWith("video/webm") && safeSupported(m),
                ) ?? "video/webm";

            try {
                const fallback = new MediaRecorder(combinedStream, {
                    mimeType: fallbackMime,
                });
                fallback.ondataavailable = handleData;
                fallback.onstop = handleStop;
                fallback.onerror = () => {
                    if (!isCurrent()) return;
                    setError("Encoder video gagal. Rekaman dihentikan.");
                    try {
                        if (fallback.state !== "inactive") fallback.stop();
                    } catch {
                        /* already stopped */
                    }
                };
                rec.recorder = fallback;
                fallback.start(500);
                setNotice(
                    "Encoder MP4 gagal di perangkat ini — perekaman dilanjutkan dengan format WebM.",
                );
            } catch {
                clearInterval(rec.timer);
                stopOwnedTracks(rec);
                if (rec.audioCtx && rec.audioCtx.state !== "closed") {
                    void rec.audioCtx.close().catch(() => {});
                }
                recRef.current = null;
                setStatus("idle");
                setError(
                    "Encoder video gagal di perangkat ini. Rekaman dihentikan.",
                );
            }
        };

        videoTrack.onended = () => {
            if (recRef.current === rec) {
                try {
                    if (rec.recorder.state !== "inactive") rec.recorder.stop();
                } catch {
                    /* noop */
                }
                setNotice(
                    "Berbagi layar berhenti — rekaman tersimpan, silakan unduh.",
                );
            }
        };

        try {
            recorder.start(500);
            setStatus("recording");
        } catch {
            teardown(rec);
            recRef.current = null;
            leaveOwnFullscreen();
            setError("Gagal memulai perekaman video.");
        }
    }, [micStream, screenStreamRef, teardown, stopOwnedTracks, startNative]);

    const stop = useCallback(() => {
        if (nativeRef.current) {
            void finalizeNative();
            return null;
        }

        const rec = recRef.current;
        if (!rec) return blobRef.current;
        try {
            if (rec.recorder.state !== "inactive") {
                rec.recorder.stop();
            } else {
                teardown(rec);
                recRef.current = null;
                setStatus("idle");
            }
        } catch {
            teardown(rec);
            recRef.current = null;
            setStatus("idle");
        }
        if (rec.ownFullscreen && document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
        }
        return null;
    }, [finalizeNative, teardown]);

    const clearError = useCallback(() => setError(null), []);
    const clearNotice = useCallback(() => setNotice(null), []);

    // The screencast can end from the desktop shell (or the shared window can
    // be closed) before the user presses Stop. Finish the file then, instead of
    // counting a recording that is no longer running.
    useEffect(() => {
        const bridge = nativeBridge();
        const off = bridge?.onScreenRecordingEnded?.(() => {
            if (!nativeRef.current) return;
            setNotice("Berbagi layar berhenti — rekaman diselesaikan.");
            void finalizeNative();
        });
        return off;
    }, [finalizeNative]);

    useEffect(
        () => () => {
            const native = nativeRef.current;
            if (native) {
                clearInterval(native.timer);
                nativeRef.current = null;
                void nativeBridge()?.stopScreenRecording?.();
            }
            const rec = recRef.current;
            if (rec) teardown(rec);
            setBlobUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        },
        [teardown],
    );

    return {
        status,
        elapsedMs,
        error,
        notice,
        blobUrl,
        filePath,
        fileBytes,
        fileName,
        start,
        stop,
        clearError,
        clearNotice,
    };
}
