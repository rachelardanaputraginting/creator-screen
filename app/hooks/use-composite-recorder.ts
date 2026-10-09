"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const PIP_W = 480;
export const PIP_H = 270;
export const PIP_MARGIN = 48;
export const FPS = 30;

const MIME_FALLBACK = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "",
];

interface CompositeRecorderArgs {
  screenVideo: HTMLVideoElement | null;
  cameraVideo: HTMLVideoElement | null;
  mirror: boolean;
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

function fileNameFor(date: Date) {
  return `creator-screen-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.webm`;
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  W: number,
  H: number
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.min(W / vw, H / vh);
  const w = vw * scale;
  const h = vh * scale;
  ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number
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

export function useCompositeRecorder({ screenVideo, cameraVideo, mirror }: CompositeRecorderArgs): {
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
    if (!screenVideo || !cameraVideo) {
      setError("Aktifkan layar dan kamera dulu sebelum merekam.");
      return;
    }
    const mime = MIME_FALLBACK.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime && mime !== "") {
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
      if (screenVideo.readyState >= 2) drawContain(ctx, screenVideo, WIDTH, HEIGHT);
      if (cameraVideo.readyState >= 2) {
        const x = WIDTH - PIP_W - PIP_MARGIN;
        const y = HEIGHT - PIP_H - PIP_MARGIN;
        ctx.save();
        if (mirrorRef.current) {
          ctx.translate(x + PIP_W, 0);
          ctx.scale(-1, 1);
          drawCover(ctx, cameraVideo, 0, y, PIP_W, PIP_H);
        } else {
          drawCover(ctx, cameraVideo, x, y, PIP_W, PIP_H);
        }
        ctx.restore();
      }
      rec.raf = requestAnimationFrame(loop);
    };

    const stream = canvas.captureStream(FPS);
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder =
        mime === ""
          ? new MediaRecorder(stream)
          : new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    } catch {
      setError("Browser tidak mendukung perekaman video.");
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const startedAt = Date.now();
    const rec: ActiveRecording = {
      raf: 0,
      timer: setInterval(() => setElapsedMs(Date.now() - startedAt), 500),
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
  }, [screenVideo, cameraVideo, teardown]);

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
    []
  );

  return { status, elapsedMs, error, blobUrl, fileName, start, stop, clearError };
}
