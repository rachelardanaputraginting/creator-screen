"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readAbout, type AboutData } from "@/app/lib/about";
import { TECH_ITEMS } from "@/app/components/tech-marquee";

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const PANEL_X = 1560;
export const PANEL_W = 360;
export const PANEL_PAD = 24;
export const CAM_W = 312;
export const CAM_H = 176;
export const TICKER_H = 76;
export const CARD_RADIUS = 24;
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
    canvasStream: MediaStream;
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
    frames: number;
}

function stopCanvasTracks(rec: ActiveRecording) {
    rec.canvasStream.getVideoTracks().forEach((t) => t.stop());
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

interface StageTheme {
    panelBg: string;
    text: string;
    muted: string;
    border: string;
    tickerBg: string;
    avatarBg: string;
}

function themeFor(dark: boolean): StageTheme {
    return dark
        ? {
              panelBg: "#141414",
              text: "#FFFFFF",
              muted: "#B0B0B0",
              border: "rgba(255,255,255,0.18)",
              tickerBg: "rgba(8,8,8,0.94)",
              avatarBg: "#2A2A2A",
          }
        : {
              panelBg: "#FFFFFF",
              text: "#111111",
              muted: "#5A5A5A",
              border: "rgba(0,0,0,0.14)",
              tickerBg: "rgba(244,244,244,0.96)",
              avatarBg: "#E4E4E4",
          };
}

function roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function initialsOf(name: string): string {
    const initials = name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    return initials || "-";
}

function sampleAverage(
    sampleCtx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
): string {
    try {
        const sw = sampleCtx.canvas.width;
        const sh = sampleCtx.canvas.height;
        sampleCtx.drawImage(video, 0, 0, sw, sh);
        const data = sampleCtx.getImageData(0, 0, sw, sh).data;
        let r = 0;
        let g = 0;
        let b = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }
        return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
    } catch {
        return "#000000";
    }
}

function drawPanel(
    ctx: CanvasRenderingContext2D,
    about: AboutData,
    cameraVideo: HTMLVideoElement | null,
    mirror: boolean,
    dark: boolean,
) {
    const theme = themeFor(dark);
    ctx.fillStyle = theme.panelBg;
    ctx.fillRect(PANEL_X, 0, PANEL_W, HEIGHT);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PANEL_X + 1, 0);
    ctx.lineTo(PANEL_X + 1, HEIGHT);
    ctx.stroke();

    const tx = PANEL_X + PANEL_PAD;
    const maxW = PANEL_W - PANEL_PAD * 2;

    // Avatar + name header (mirrors AboutPanel).
    const ax = tx + 44;
    const ay = 88;
    ctx.fillStyle = theme.avatarBg;
    ctx.beginPath();
    ctx.arc(ax, ay, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.text;
    ctx.font = "600 30px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialsOf(about.name || ""), ax, ay + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = theme.text;
    ctx.font = "600 34px Manrope, sans-serif";
    ctx.fillText(about.name || "-", tx + 104, 78, maxW - 104);
    ctx.fillStyle = theme.muted;
    ctx.font = "26px Manrope, sans-serif";
    ctx.fillText(about.role || "", tx + 104, 112, maxW - 104);

    ctx.font = "24px Manrope, sans-serif";
    const bioLines = wrapText(ctx, about.bio || "", maxW, 3);
    bioLines.forEach((line, i) => {
        ctx.fillText(line, tx, 168 + i * 30, maxW);
    });

    const linkY = 168 + bioLines.length * 30 + 10;
    if (about.link) ctx.fillText(about.link, tx, linkY, maxW);

    const camY = linkY + 56;
    const camX = PANEL_X + PANEL_PAD;
    ctx.fillStyle = "#000000";
    roundRectPath(ctx, camX, camY, CAM_W, CAM_H, 16);
    ctx.fill();
    if (cameraVideo && cameraVideo.readyState >= 2) {
        ctx.save();
        roundRectPath(ctx, camX, camY, CAM_W, CAM_H, 16);
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
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    roundRectPath(ctx, camX, camY, CAM_W, CAM_H, 16);
    ctx.stroke();
}

function drawTicker(
    ctx: CanvasRenderingContext2D,
    elapsedMs: number,
    dark: boolean,
) {
    const theme = themeFor(dark);
    const y = HEIGHT - TICKER_H;
    ctx.fillStyle = theme.tickerBg;
    ctx.fillRect(0, y, WIDTH, TICKER_H);
    ctx.fillStyle = theme.border;
    ctx.fillRect(0, y, WIDTH, 2);

    const text = TECH_ITEMS.join("   \u2022   ") + "   \u2022   ";
    ctx.font = "500 28px Manrope, sans-serif";
    ctx.textBaseline = "middle";
    const textW = ctx.measureText(text).width;
    if (textW <= 0) {
        ctx.textBaseline = "alphabetic";
        return;
    }
    const speed = 120;
    const off = ((elapsedMs / 1000) * speed) % textW;
    ctx.fillStyle = theme.muted;
    for (let x = WIDTH - off; x > -textW; x -= textW) {
        ctx.fillText(text, x, y + TICKER_H / 2 + 1, textW);
    }
    ctx.textBaseline = "alphabetic";
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
    const darkRef = useRef<boolean>(
        typeof document !== "undefined"
            ? document.documentElement.classList.contains("dark")
            : true,
    );
    const bgRef = useRef<string>("#000000");
    const tickRef = useRef(0);

    const teardown = useCallback((rec: ActiveRecording) => {
        cancelAnimationFrame(rec.raf);
        clearInterval(rec.timer);
        try {
            if (rec.recorder.state !== "inactive") rec.recorder.stop();
        } catch {
            /* already stopped */
        }
        stopCanvasTracks(rec);
    }, []);

    const start = useCallback(async () => {
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
        try {
            await Promise.race([
                document.fonts.ready,
                new Promise((resolve) => setTimeout(resolve, 1500)),
            ]);
        } catch {
            /* fall back to sans-serif */
        }

        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = 32;
        sampleCanvas.height = 18;
        const sampleCtx = sampleCanvas.getContext("2d", {
            willReadFrequently: true,
        });

        const loop = () => {
            const rec = recRef.current;
            if (!rec) return;
            rec.frames += 1;
            if (
                rec.frames % 60 === 1 &&
                sampleCtx &&
                screenVideo.readyState >= 2
            ) {
                bgRef.current = sampleAverage(sampleCtx, screenVideo);
            }
            const dark = darkRef.current;
            const theme = themeFor(dark);

            ctx.fillStyle = bgRef.current;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            if (screenVideo.readyState >= 2) {
                const sx = PANEL_PAD;
                const sy = PANEL_PAD;
                const sw = PANEL_X - PANEL_PAD * 2;
                const sh = HEIGHT - PANEL_PAD * 2;
                ctx.save();
                roundRectPath(ctx, sx, sy, sw, sh, CARD_RADIUS);
                ctx.clip();
                drawContainIn(ctx, screenVideo, sx, sy, sw, sh);
                ctx.restore();
                ctx.strokeStyle = theme.border;
                ctx.lineWidth = 3;
                roundRectPath(ctx, sx, sy, sw, sh, CARD_RADIUS);
                ctx.stroke();
            }
            drawPanel(
                ctx,
                aboutRef.current,
                cameraVideo,
                mirrorRef.current,
                dark,
            );
            drawTicker(ctx, Date.now() - rec.startedAt, dark);
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
            canvasStream.getVideoTracks().forEach((t) => t.stop());
            return;
        }

        const startedAt = Date.now();
        tickRef.current = 0;
        aboutRef.current = readAbout();
        darkRef.current = document.documentElement.classList.contains("dark");
        bgRef.current = "#000000";
        const rec: ActiveRecording = {
            raf: 0,
            timer: setInterval(() => {
                setElapsedMs(Date.now() - startedAt);
                tickRef.current += 1;
                if (tickRef.current % 4 === 0) {
                    aboutRef.current = readAbout();
                    darkRef.current =
                        document.documentElement.classList.contains("dark");
                }
            }, 500),
            stream,
            canvasStream,
            recorder,
            chunks,
            startedAt,
            frames: 0,
        };
        recRef.current = rec;

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
            const active = recRef.current === rec;
            cancelAnimationFrame(rec.raf);
            clearInterval(rec.timer);
            stopCanvasTracks(rec);
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
                stopCanvasTracks(rec);
                recRef.current = null;
                setStatus("idle");
            }
        } catch {
            cancelAnimationFrame(rec.raf);
            clearInterval(rec.timer);
            stopCanvasTracks(rec);
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
                stopCanvasTracks(rec);
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
