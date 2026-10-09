"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readAbout, type AboutData } from "@/app/lib/about";

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const PANEL_X = 1560;
export const PANEL_W = 360;
export const PANEL_PAD = 24;
export const CAM_W = 312;
export const CAM_H = 176;
export const FPS = 30;

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

interface CompositeRecorderArgs {
    screenVideo: HTMLVideoElement | null;
    cameraVideo: HTMLVideoElement | null;
    mirror: boolean;
    micStream: MediaStream | null;
}

interface ActiveRecording {
    raf: number;
    timer: ReturnType<typeof setInterval>;
    stream: MediaStream;
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
}

function pad(n: number) {
    return String(n).padStart(2, "0");
}

function isVideoLive(
    video: HTMLVideoElement | null,
): video is HTMLVideoElement {
    if (!video) return false;
    const stream = video.srcObject as MediaStream | null;
    const hasLiveTrack =
        stream?.getVideoTracks().some((t) => t.readyState === "live") ?? false;
    return hasLiveTrack && video.readyState >= 2;
}

function fileNameFor(date: Date) {
    return `creator-screen-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.webm`;
}

function drawContain(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    W: number,
    H: number,
) {
    drawContainIn(ctx, video, 0, 0, W, H);
}

function drawContainIn(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number,
): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
        const trial = current ? `${current} ${word}` : word;
        if (ctx.measureText(trial).width <= maxWidth || !current) {
            current = trial;
        } else {
            lines.push(current);
            current = word;
            if (lines.length === maxLines) break;
        }
    }
    if (lines.length < maxLines && current) lines.push(current);
    const result = lines.slice(0, maxLines);
    if (words.length > 0 && result.join(" ").length < text.length) {
        const last = result.length - 1;
        let truncated = result[last];
        while (
            truncated.length > 1 &&
            ctx.measureText(`${truncated}…`).width > maxWidth
        ) {
            truncated = truncated.slice(0, -1);
        }
        result[last] = `${truncated}…`;
    }
    return result;
}

function drawPanel(
    ctx: CanvasRenderingContext2D,
    about: AboutData,
    cameraVideo: HTMLVideoElement | null,
    mirror: boolean,
) {
    ctx.fillStyle = "#111111";
    ctx.fillRect(PANEL_X, 0, PANEL_W, HEIGHT);
    const tx = PANEL_X + PANEL_PAD;
    const maxW = PANEL_W - PANEL_PAD * 2;

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 44px Manrope, sans-serif";
    ctx.fillText(about.name || "-", tx, 110, maxW);

    ctx.fillStyle = "#B0B0B0";
    ctx.font = "28px Manrope, sans-serif";
    ctx.fillText(about.role || "", tx, 155, maxW);

    ctx.font = "26px Manrope, sans-serif";
    const bioLines = wrapText(ctx, about.bio || "", maxW, 4);
    bioLines.forEach((line, i) => {
        ctx.fillText(line, tx, 195 + i * 32, maxW);
    });

    const linkY = 195 + bioLines.length * 32 + 12;
    if (about.link) ctx.fillText(about.link, tx, linkY, maxW);

    const camY = linkY + 64;
    const camX = PANEL_X + PANEL_PAD;
    ctx.fillStyle = "#000000";
    ctx.fillRect(camX, camY, CAM_W, CAM_H);
    if (cameraVideo && cameraVideo.readyState >= 2) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(camX, camY, CAM_W, CAM_H);
        ctx.clip();
        if (mirror) {
            ctx.translate(camX + CAM_W, 0);
            ctx.scale(-1, 1);
            drawCover(ctx, cameraVideo, 0, camY, CAM_W, CAM_H);
        } else {
            drawCover(ctx, cameraVideo, camX, camY, CAM_W, CAM_H);
        }
        ctx.restore();
    }
}

function drawCover(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.max(w / vw, h / vh);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
}

export function useCompositeRecorder({
    screenVideo,
    cameraVideo,
    mirror,
    micStream,
}: CompositeRecorderArgs): {
    status: "idle" | "recording";
    elapsedMs: number;
    error: string | null;
    blobUrl: string | null;
    fileName: string;
    start: () => void;
    stop: () => Blob | null;
    clearError: () => void;
} {
    const [status, setStatus] = useState<"idle" | "recording">("idle");
    const [elapsedMs, setElapsedMs] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState("creator-screen.webm");
    const recRef = useRef<ActiveRecording | null>(null);
    const blobRef = useRef<Blob | null>(null);
    const mirrorRef = useRef(mirror);
    mirrorRef.current = mirror;
    const aboutRef = useRef<AboutData>(readAbout());
    const tickRef = useRef(0);

    const teardown = useCallback((rec: ActiveRecording) => {
        cancelAnimationFrame(rec.raf);
        clearInterval(rec.timer);
        try {
            if (rec.recorder.state !== "inactive") rec.recorder.stop();
        } catch {
            /* already stopped */
        }
        rec.stream.getTracks().forEach((t) => t.stop());
    }, []);

    const start = useCallback(() => {
        if (recRef.current) return;
        if (typeof MediaRecorder === "undefined") {
            setError("Browser tidak mendukung perekaman video.");
            return;
        }
        if (!isVideoLive(screenVideo) || !isVideoLive(cameraVideo)) {
            setError("Aktifkan layar dan kamera dulu sebelum merekam.");
            return;
        }
        const mime = MIME_FALLBACK.find((m) => safeSupported(m));
        if (mime === undefined) {
            setError("Browser tidak mendukung perekaman video.");
            return;
        }

        setError(null);
        setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        blobRef.current = null;
        setElapsedMs(0);

        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            setError("Gagal menyiapkan kanvas rekaman.");
            return;
        }

        const loop = () => {
            const rec = recRef.current;
            if (!rec) return;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            if (screenVideo.readyState >= 2) {
                drawContainIn(
                    ctx,
                    screenVideo,
                    PANEL_PAD,
                    PANEL_PAD,
                    PANEL_X - PANEL_PAD * 2,
                    HEIGHT - PANEL_PAD * 2,
                );
            }
            drawPanel(ctx, aboutRef.current, cameraVideo, mirrorRef.current);
            rec.raf = requestAnimationFrame(loop);
        };

        const canvasStream = canvas.captureStream(FPS);
        const micTracks =
            micStream
                ?.getAudioTracks()
                .filter((t) => t.readyState === "live") ?? [];
        const stream =
            micTracks.length > 0
                ? new MediaStream([
                      ...canvasStream.getVideoTracks(),
                      ...micTracks,
                  ])
                : canvasStream;
        const chunks: Blob[] = [];
        let recorder: MediaRecorder;
        try {
            recorder =
                mime === ""
                    ? new MediaRecorder(stream)
                    : new MediaRecorder(stream, {
                          mimeType: mime,
                          videoBitsPerSecond: 8_000_000,
                      });
        } catch {
            setError("Browser tidak mendukung perekaman video.");
            stream.getTracks().forEach((t) => t.stop());
            return;
        }

        const startedAt = Date.now();
        tickRef.current = 0;
        aboutRef.current = readAbout();
        const rec: ActiveRecording = {
            raf: 0,
            timer: setInterval(() => {
                setElapsedMs(Date.now() - startedAt);
                tickRef.current += 1;
                if (tickRef.current % 4 === 0) aboutRef.current = readAbout();
            }, 500),
            stream,
            recorder,
            chunks,
            startedAt,
        };
        recRef.current = rec;

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
            const active = recRef.current === rec;
            cancelAnimationFrame(rec.raf);
            clearInterval(rec.timer);
            rec.stream.getTracks().forEach((t) => t.stop());
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

        rec.raf = requestAnimationFrame(loop);
        try {
            recorder.start(250);
        } catch {
            teardown(rec);
            recRef.current = null;
            setError("Gagal memulai perekaman.");
            return;
        }
        setStatus("recording");
    }, [screenVideo, cameraVideo, micStream, teardown]);

    const stop = useCallback(() => {
        const rec = recRef.current;
        if (!rec) return blobRef.current;
        try {
            if (rec.recorder.state !== "inactive") rec.recorder.stop();
            else {
                cancelAnimationFrame(rec.raf);
                clearInterval(rec.timer);
                rec.stream.getTracks().forEach((t) => t.stop());
                recRef.current = null;
                setStatus("idle");
            }
        } catch {
            cancelAnimationFrame(rec.raf);
            clearInterval(rec.timer);
            recRef.current = null;
            setStatus("idle");
        }
        return null;
    }, []);

    const clearError = useCallback(() => setError(null), []);

    useEffect(
        () => () => {
            const rec = recRef.current;
            if (rec) {
                cancelAnimationFrame(rec.raf);
                clearInterval(rec.timer);
                try {
                    if (rec.recorder.state !== "inactive") rec.recorder.stop();
                } catch {
                    /* noop */
                }
                rec.stream.getTracks().forEach((t) => t.stop());
                recRef.current = null;
            }
            setBlobUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        },
        [],
    );

    return {
        status,
        elapsedMs,
        error,
        blobUrl,
        fileName,
        start,
        stop,
        clearError,
    };
}
