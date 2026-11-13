"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/stores/canvas-store";
import type { Scene, SceneDevices } from "@/types/scene";
import { BackgroundType } from "@/types/scene";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Alert,
    AlertAction,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AboutPanel from "./about-panel";
import TechMarquee from "./tech-marquee";
import ThemeToggle from "./theme-toggle";
import MicLevelMeter from "./mic-level-meter";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useStageRecorder } from "@/app/hooks/use-stage-recorder";
import {
    createEnhancedMicrophoneStream,
    AudioEnhancerPipeline,
} from "@/app/lib/audio-enhancer";
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    MonitorUp,
    MonitorOff,
    Camera,
    CameraOff,
    Mic,
    MicOff,
    Maximize,
    Minimize,
    Play,
    Square,
    Circle,
    Download,
    Scaling,
    PanelRightClose,
    PanelRightOpen,
    Sparkles,
    SlidersHorizontal,
    Volume2,
    ShieldCheck,
} from "lucide-react";

interface SceneScreen {
    stream: MediaStream;
    audioOn: boolean;
    label: string;
}

/** Human readable file size for the "saved" notice. */
function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const rounded =
        unit === 0 || value >= 10
            ? Math.round(value)
            : Math.round(value * 10) / 10;
    return `${rounded.toLocaleString("id-ID")} ${units[unit]}`;
}

function defaultScenes(): Scene[] {
    const screen = {
        id: "source-screen",
        type: "screen" as const,
        label: "Display 1",
        active: true,
    };
    return [
        {
            id: "coding",
            name: "Coding",
            source: { ...screen },
            overlays: [],
            background: BackgroundType.Solid,
            canvasWidth: 1920,
            canvasHeight: 1080,
            devices: {
                cameraOn: true,
                micOn: true,
                micDeviceId: "",
                mirror: true,
            },
        },
        {
            id: "browser",
            name: "Browser",
            source: {
                ...screen,
                id: "source-browser",
                label: "Browser Window",
            },
            overlays: [],
            background: BackgroundType.Solid,
            canvasWidth: 1920,
            canvasHeight: 1080,
            devices: {
                cameraOn: true,
                micOn: false,
                micDeviceId: "",
                mirror: true,
            },
        },
        {
            id: "terminal",
            name: "Terminal",
            source: { ...screen, id: "source-terminal", label: "Terminal" },
            overlays: [],
            background: BackgroundType.Solid,
            canvasWidth: 1920,
            canvasHeight: 1080,
            devices: {
                cameraOn: false,
                micOn: true,
                micDeviceId: "",
                mirror: true,
            },
        },
        {
            id: "presentation",
            name: "Presentation",
            source: { ...screen, id: "source-presentation", label: "Deck" },
            overlays: [],
            background: BackgroundType.Solid,
            canvasWidth: 1920,
            canvasHeight: 1080,
            devices: {
                cameraOn: true,
                micOn: true,
                micDeviceId: "",
                mirror: true,
            },
        },
    ];
}

interface ScreenVideoPlayerProps {
    stream: MediaStream | null;
    screenFit: "contain" | "cover";
    onVideoRef?: (node: HTMLVideoElement | null) => void;
}

function ScreenVideoPlayer({
    stream,
    screenFit,
    onVideoRef,
}: ScreenVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const playVideo = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = true;
        void video.play().catch(() => {});
    }, []);

    const setRef = useCallback(
        (node: HTMLVideoElement | null) => {
            videoRef.current = node;
            onVideoRef?.(node);
            if (node) {
                node.muted = true;
                if (stream && node.srcObject !== stream) {
                    node.srcObject = stream;
                }
                void node.play().catch(() => {});
            }
        },
        [stream, onVideoRef],
    );

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;

        video.muted = true;
        if (video.srcObject !== stream) {
            video.srcObject = stream;
        }
        playVideo();

        const [track] = stream.getVideoTracks();
        if (!track) return;

        const handleTrackActive = () => playVideo();
        track.addEventListener("unmute", handleTrackActive);

        return () => {
            track.removeEventListener("unmute", handleTrackActive);
        };
    }, [stream, playVideo]);

    return (
        <video
            ref={setRef}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                el.muted = true;
                void el.play().catch(() => {});
            }}
            onCanPlay={(e) => {
                const el = e.currentTarget;
                el.muted = true;
                void el.play().catch(() => {});
            }}
            className={cn(
                "absolute inset-0 size-full w-full h-full transition-all duration-200",
                screenFit === "cover" ? "object-cover" : "object-contain",
            )}
        />
    );
}

export default function EditorLayout() {
    const {
        currentScene,
        scenes,
        setScenes,
        switchScene,
        isFullscreen,
        setIsFullscreen,
        isSessionActive,
        setIsSessionActive,
        screenFit,
        setScreenFit,
        sidebarCollapsed,
        setSidebarCollapsed,
        noiseSuppression,
        setNoiseSuppression,
        echoCancellation,
        setEchoCancellation,
        autoGainControl,
        setAutoGainControl,
        voiceEnhancer,
        setVoiceEnhancer,
    } = useStore();

    const [mediaError, setMediaError] = useState<string | null>(null);
    const [recordNotice, setRecordNotice] = useState<string | null>(null);
    const [recordNoticeTitle, setRecordNoticeTitle] = useState(
        "Rekaman tersimpan",
    );
    // Screen aktif per scene — jika scene belum memilih screen spesifik,
    // gunakan screen yang sudah aktif agar tidak hilang saat berpindah scene.
    const [screensByScene, setScreensByScene] = useState<
        Record<string, SceneScreen>
    >({});
    const screensBySceneRef = useRef<Record<string, SceneScreen>>({});
    const currentSceneId = currentScene?.id ?? "";
    const activeScreen = (() => {
        const byScene = screensByScene[currentSceneId];
        if (
            byScene &&
            byScene.stream.getVideoTracks().some((t) => t.readyState === "live")
        ) {
            return byScene;
        }
        const anyLive = Object.values(screensByScene).find((s) =>
            s.stream.getVideoTracks().some((t) => t.readyState === "live"),
        );
        return anyLive || byScene || Object.values(screensByScene)[0] || null;
    })();
    const screenOn = !!activeScreen;
    const screenAudioOn = activeScreen?.audioOn ?? false;
    const [cameraOn, setCameraOn] = useState(false);
    const [micOn, setMicOn] = useState(false);
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicId, setSelectedMicId] = useState("");
    const [micLabel, setMicLabel] = useState("");
    const [mirror, setMirror] = useState(true);
    const stallOverlayRef = useRef<HTMLDivElement | null>(null);
    const whiteDismissedRef = useRef(false);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioPipelineRef = useRef<AudioEnhancerPipeline | null>(null);
    const initializedRef = useRef(false);

    const showNotice = useCallback((message: string, title?: string) => {
        setRecordNoticeTitle(title ?? "Rekaman tersimpan");
        setRecordNotice(message);
    }, []);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;
        const st = useStore.getState();
        // Reset runtime flags — localStorage lama (sebelum partialize) bisa
        // masih menyimpan session/fullscreen nyangkut; fresh load tidak
        // pernah sah berada di session.
        st.setIsSessionActive(false);
        st.setIsFullscreen(false);
        const deduped = Array.from(
            new Map(st.scenes.map((s) => [s.id, s])).values(),
        );
        const merged = [...deduped];
        for (const d of defaultScenes()) {
            if (!merged.some((s) => s.id === d.id)) merged.push(d);
        }
        if (merged.length !== st.scenes.length) st.setScenes(merged);
        const target =
            merged.find((s) => s.id === st.currentScene?.id) ?? merged[0];
        if (target) st.switchScene(target.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, [setIsFullscreen]);

    const enterFullscreen = useCallback(async () => {
        try {
            await document.documentElement.requestFullscreen();
        } catch {
            setMediaError(
                "Unable to enter fullscreen. Try pressing F11 instead.",
            );
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
        } catch {
            /* noop */
        }
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) void exitFullscreen();
        else void enterFullscreen();
    }, [enterFullscreen, exitFullscreen]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && statusRef.current === "recording") {
                recorder.stop();
                return;
            }
            if (e.key === "Escape" && useStore.getState().isSessionActive) {
                useStore.getState().setIsSessionActive(false);
                useStore.getState().setIsFullscreen(false);
                void exitFullscreen();
                return;
            }
            if (e.ctrlKey && e.shiftKey && (e.key === "F" || e.key === "f")) {
                e.preventDefault();
                toggleFullscreen();
                return;
            }
            if (e.ctrlKey && ["1", "2", "3", "4"].includes(e.key)) {
                e.preventDefault();
                const idx = Number(e.key) - 1;
                const s = useStore.getState().scenes[idx];
                if (s) useStore.getState().switchScene(s.id);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggleFullscreen, exitFullscreen]);

    // Sinkronkan ref screen aktif (dipakai recorder untuk system audio)
    // dan pasang ke elemen preview. Setiap ganti scene / ganti screen,
    // stream yang dirender otomatis ikut berganti.
    useEffect(() => {
        screensBySceneRef.current = screensByScene;
        screenStreamRef.current =
            screensByScene[currentSceneId]?.stream ?? null;
        if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenStreamRef.current;
            if (screenStreamRef.current) {
                void screenVideoRef.current.play().catch(() => {});
            }
        }
    }, [screensByScene, currentSceneId]);

    // Di Wayland, jendela sumber yang tertutup jendela lain dikirim portal
    // sebagai frame putih kosong. Sampel frame video; kalau hampir seluruhnya
    // putih, tampilkan peringatan (bisa ditutup untuk konten yang putih sah).
    useEffect(() => {
        const overlay = stallOverlayRef.current;
        if (overlay) overlay.style.display = "none";
        whiteDismissedRef.current = false;
        const stream = screensByScene[currentSceneId]?.stream;
        if (!stream) return;
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 18;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        let whiteTicks = 0;
        const timer = window.setInterval(() => {
            const video = screenVideoRef.current;
            if (!video || video.readyState < 2 || !video.videoWidth) return;
            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            } catch {
                return;
            }
            const d = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            let white = 0;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) white++;
            }
            if (white / (d.length / 4) > 0.96) whiteTicks += 1;
            else whiteTicks = 0;
            if (overlay)
                overlay.style.display =
                    whiteTicks >= 3 && !whiteDismissedRef.current
                        ? "flex"
                        : "none";
        }, 1500);
        return () => window.clearInterval(timer);
    }, [screensByScene, currentSceneId]);

    useEffect(() => {
        if (cameraVideoRef.current && cameraStreamRef.current) {
            cameraVideoRef.current.srcObject = cameraStreamRef.current;
            void cameraVideoRef.current.play().catch(() => {});
        }
    }, [cameraOn]);

    const attachScreenVideo = useCallback((node: HTMLVideoElement | null) => {
        screenVideoRef.current = node;
        if (node && screenStreamRef.current) {
            node.srcObject = screenStreamRef.current;
            void node.play().catch(() => {});
        }
    }, []);

    const attachCameraVideo = useCallback((node: HTMLVideoElement | null) => {
        cameraVideoRef.current = node;
        if (node && cameraStreamRef.current) {
            node.srcObject = cameraStreamRef.current;
            void node.play().catch(() => {});
        }
    }, []);

    const recorder = useStageRecorder({
        micStream,
        micLabel,
        screenStreamRef,
    });
    const recording = recorder.status === "recording";
    const fileExt = recorder.fileName.endsWith(".mp4") ? "mp4" : "webm";
    const statusRef = useRef(recorder.status);
    statusRef.current = recorder.status;

    // Simpan rekaman. Di aplikasi desktop, file ditulis oleh proses utama
    // (dialog async + stream byte ke disk) supaya tidak lewat downloader
    // Chromium — downloader itu menaruh `<uuid>.tmp` di folder Downloads dan
    // baru menamainya setelah save diterapkan, jadi dialog yang dibatalkan
    // meninggalkan file .tmp dan rekaman tidak tersimpan.
    //
    // Satu unduhan pada satu waktu: dialog native yang dobel akan membuat dua
    // file dari rekaman yang sama.
    const savingRecordingRef = useRef(false);
    const downloadRecording = useCallback(
        async (url: string, name: string) => {
            if (savingRecordingRef.current) return;

            const ext = name.endsWith(".mp4") ? "mp4" : "webm";
            let safeName = name.trim();
            if (!safeName.endsWith(".mp4") && !safeName.endsWith(".webm")) {
                safeName = `${safeName}.${ext}`;
            }

            const bridge = window.creatorScreen;
            if (bridge) {
                savingRecordingRef.current = true;
                try {
                    const blob = await (await fetch(url)).blob();
                    if (blob.size === 0) {
                        showNotice(
                            "Hasil rekaman kosong (0 bytes). Pastikan panggung memiliki konten saat merekam.",
                            "Rekaman Kosong",
                        );
                        return;
                    }
                    // Name the file after the bytes we actually hold: a stale
                    // state value must never label WebM data `.mp4` (or the
                    // reverse), because desktop players refuse such a file.
                    const blobExt = blob.type.includes("mp4")
                        ? "mp4"
                        : blob.type.includes("webm")
                          ? "webm"
                          : ext;
                    const baseName = safeName.replace(/\.(mp4|webm|mkv)$/i, "");
                    // Pass the Blob itself — the bridge slices it per chunk, so
                    // the recording is never copied into one giant array.
                    const res = await bridge.saveRecording(
                        blob,
                        `${baseName}.${blobExt}`,
                    );
                    if (res?.error) {
                        showNotice(
                            `Gagal menyimpan rekaman: ${res.error}`,
                            "Gagal menyimpan",
                        );
                        return;
                    }
                    if (res?.saved && res.path) {
                        const size = formatFileSize(res.bytes);
                        showNotice(
                            `Rekaman berhasil disimpan${size ? ` (${size})` : ""} di: ${res.path}`,
                            "Tersimpan",
                        );
                    }
                } catch (err) {
                    showNotice(
                        `Gagal menyimpan rekaman ke disk: ${
                            err instanceof Error ? err.message : String(err)
                        }`,
                        "Gagal menyimpan",
                    );
                } finally {
                    savingRecordingRef.current = false;
                }
                return;
            }

            try {
                const blob = await (await fetch(url)).blob();
                if (blob.size === 0) {
                    showNotice(
                        "Hasil rekaman kosong (0 bytes). Pastikan panggung memiliki konten saat merekam.",
                        "Rekaman Kosong",
                    );
                    return;
                }
            } catch {
                /* ignore */
            }

            const a = document.createElement("a");
            a.href = url;
            a.download = safeName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showNotice("File rekaman sedang diunduh oleh browser.", "Mengunduh");
        },
        [showNotice],
    );

    // Simpan rekaman native: berkasnya sudah ada di cache aplikasi, jadi
    // backend hanya menyalinnya ke lokasi yang dipilih pengguna.
    const saveRecordedFile = useCallback(
        async (path: string, name: string) => {
            if (savingRecordingRef.current) return;
            const bridge = window.creatorScreen;
            if (!bridge?.saveRecordingFile) {
                showNotice(
                    "Penyimpanan berkas rekaman tidak tersedia di build ini.",
                    "Gagal menyimpan",
                );
                return;
            }

            savingRecordingRef.current = true;
            try {
                const res = await bridge.saveRecordingFile(path, name);
                if (res?.canceled) return;
                if (res?.error) {
                    showNotice(
                        `Gagal menyimpan rekaman: ${res.error}`,
                        "Gagal menyimpan",
                    );
                    return;
                }
                if (res?.saved && res.path) {
                    const size = formatFileSize(res.bytes);
                    showNotice(
                        `Rekaman berhasil disimpan${size ? ` (${size})` : ""} di: ${res.path}`,
                        "Tersimpan",
                    );
                }
            } catch (err) {
                showNotice(
                    `Gagal menyimpan rekaman ke disk: ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                    "Gagal menyimpan",
                );
            } finally {
                savingRecordingRef.current = false;
            }
        },
        [showNotice],
    );

    useEffect(() => {
        document.documentElement.dataset.recording = recording
            ? "true"
            : "false";
        return () => {
            document.documentElement.dataset.recording = "false";
        };
    }, [recording]);
    const prevBlobUrl = useRef<string | null>(null);
    useEffect(() => {
        if (recorder.blobUrl && recorder.blobUrl !== prevBlobUrl.current) {
            prevBlobUrl.current = recorder.blobUrl;
            downloadRecording(recorder.blobUrl, recorder.fileName);
        }
    }, [recorder.blobUrl, recorder.fileName, downloadRecording]);

    // Rekaman native selesai → langsung tawarkan penyimpanan.
    const prevFilePath = useRef<string | null>(null);
    useEffect(() => {
        if (recorder.filePath && recorder.filePath !== prevFilePath.current) {
            prevFilePath.current = recorder.filePath;
            void saveRecordedFile(recorder.filePath, recorder.fileName);
        }
    }, [recorder.filePath, recorder.fileName, saveRecordedFile]);

    useEffect(() => {
        if (recorder.notice) {
            showNotice(recorder.notice);
            recorder.clearNotice();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recorder.notice]);

    // Hapus + stop stream screen milik satu scene tertentu.
    const stopSceneScreen = useCallback((sceneId: string) => {
        setScreensByScene((prev) => {
            const entry = prev[sceneId];
            if (!entry) return prev;
            entry.stream.getTracks().forEach((t) => {
                try {
                    t.stop();
                } catch {
                    /* noop */
                }
            });
            const next = { ...prev };
            delete next[sceneId];
            return next;
        });
    }, []);

    const stopScreenTracks = useCallback(() => {
        if (statusRef.current === "recording") {
            recorder.stop();
            showNotice(
                "Layar berhenti - rekaman parsial tersimpan, silakan download.",
            );
        }
        const id = useStore.getState().currentScene?.id;
        if (id) stopSceneScreen(id);
    }, [recorder, showNotice, stopSceneScreen]);

    const stopCameraTracks = useCallback(() => {
        if (statusRef.current === "recording") {
            recorder.stop();
            showNotice(
                "Kamera berhenti - rekaman parsial tersimpan, silakan download.",
            );
        }
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
        setCameraOn(false);
    }, [recorder, showNotice]);

    useEffect(
        () => () => {
            Object.values(screensBySceneRef.current).forEach((e) =>
                e.stream.getTracks().forEach((t) => t.stop()),
            );
            cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
            micStreamRef.current?.getTracks().forEach((t) => t.stop());
            audioPipelineRef.current?.stop();
        },
        [],
    );

    const handleShareScreen = useCallback(async () => {
        setMediaError(null);
        const sceneId =
            useStore.getState().currentScene?.id ||
            useStore.getState().scenes[0]?.id ||
            "coding";
        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                setMediaError(
                    "Screen capture is not supported in this browser. Try Chrome or Edge on desktop.",
                );
                return;
            }
            window.creatorScreen?.setCapturePurpose("preview");

            // Deteksi Linux (baik di desktop app Electron/Tauri maupun browser biasa):
            // Loopback audio sistem tidak didukung di Linux dan memicu OverconstrainedError.
            const isLinux =
                window.creatorScreen?.platform === "linux" ||
                (typeof navigator !== "undefined" &&
                    /linux/i.test(navigator.userAgent || ""));

            // Di Linux (Wayland/PipeWire), request display media dengan constraint ideal/resolution
            // menyebabkan Mutter/PipeWire portal hang hingga 5-10 detik menghitung fractional scaling.
            // Memanggil video: true murni membuka dialog portal SECARA INSTAN (<0.2 detik).
            let stream: MediaStream;
            try {
                if (isLinux) {
                    // WebKitGTK throws InvalidStateError when an explicit
                    // audio constraint is passed to getDisplayMedia, so pass
                    // `{ video: true }` clean without an `audio` key.
                    stream = await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                    });
                } else {
                    try {
                        stream = await navigator.mediaDevices.getDisplayMedia({
                            video: true,
                            audio: true,
                            systemAudio: "include",
                        } as DisplayMediaStreamOptions);
                    } catch {
                        stream = await navigator.mediaDevices.getDisplayMedia({
                            video: true,
                            audio: false,
                        });
                    }
                }
            } catch (err) {
                const name =
                    err instanceof DOMException
                        ? err.name
                        : (err as { name?: string } | null)?.name || "";
                if (name === "NotAllowedError" || name === "AbortError") {
                    return;
                }
                // Fallback attempt jika constraint audio / driver menolak
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                });
            }

            // Hasil picker menjadi screen milik scene AKTIF; stream lama
            // scene ini (kalau ada) dimatikan.
            const entry: SceneScreen = {
                stream,
                audioOn: stream.getAudioTracks().length > 0,
                label:
                    stream.getVideoTracks()[0]?.label || "Screen capture",
            };
            screenStreamRef.current = stream;
            setScreensByScene((prev) => {
                prev[sceneId]?.stream.getTracks().forEach((t) => {
                    try {
                        t.stop();
                    } catch {
                        /* noop */
                    }
                });
                return { ...prev, [sceneId]: entry };
            });
            if (!entry.audioOn) {
                if (isLinux) {
                    showNotice(
                        "Di Linux suara sistem belum bisa direkam melalui portal, jadi rekaman hanya memuat suara mic.",
                        "Suara komputer belum ikut",
                    );
                } else {
                    showNotice(
                        'Saat memilih layar, pilih "Entire Screen" lalu centang "Share system audio" supaya suara komputer ikut terekam. Tanpa itu rekaman hanya berisi suara mic.',
                        "Suara komputer belum ikut",
                    );
                }
            }
            // User menghentikan share lewat UI browser → bersihkan scene ini.
            stream.getVideoTracks()[0]?.addEventListener("ended", () => {
                setScreensByScene((prev) => {
                    if (prev[sceneId]?.stream !== stream) return prev;
                    const next = { ...prev };
                    delete next[sceneId];
                    return next;
                });
            });
        } catch (e) {
            const name =
                e instanceof DOMException
                    ? e.name
                    : (e as { name?: string } | null)?.name || "";
            // User membatalkan dialog pemilihan sumber layar -> bukan error sistem
            if (name === "NotAllowedError" || name === "AbortError") {
                return;
            }
            console.error("share screen failed", e);
            setMediaError(
                `Unable to access this screen${name ? ` (${name})` : ""}. Check your system permissions and try again.`,
            );
        }
    }, [showNotice]);

    const handleStopScreen = useCallback(() => {
        stopScreenTracks();
    }, [stopScreenTracks]);

    const handleEnableCamera = useCallback(async () => {
        setMediaError(null);
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setMediaError("Camera is not supported in this browser.");
                return;
            }
            // Laptop sering punya kamera IR (Windows Hello) yang menjadi
            // default dan hasilnya hitam/abnormal — hindari secara eksplisit.
            const irName = /infrared|\bir\b|hello/i;
            const openCam = (deviceId?: string) =>
                navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        ...(deviceId
                            ? { deviceId: { exact: deviceId } }
                            : { facingMode: "user" }),
                    },
                    audio: false,
                });
            let stream = await openCam();
            let track = stream.getVideoTracks()[0];
            if (track && irName.test(track.label)) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const alt = devices.find(
                    (d) =>
                        d.kind === "videoinput" &&
                        !irName.test(d.label) &&
                        d.deviceId !== track!.getSettings().deviceId,
                );
                if (alt) {
                    stream.getTracks().forEach((t) => t.stop());
                    stream = await openCam(alt.deviceId);
                    track = stream.getVideoTracks()[0];
                }
            }
            cameraStreamRef.current = stream;
            setCameraOn(true);
            track?.addEventListener("ended", () => {
                stopCameraTracks();
            });
        } catch {
            setMediaError(
                "Unable to access the camera. Check your system permissions and try again.",
            );
        }
    }, []);

    const handleStopCamera = useCallback(() => {
        stopCameraTracks();
    }, [stopCameraTracks]);

    const refreshMicDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            // Only inputs with a real deviceId are selectable — before mic
            // permission is granted the browser reports empty ids/labels, and
            // options with identical (empty) values would silently no-op.
            const seen = new Set<string>();
            const inputs: MediaDeviceInfo[] = [];
            for (const d of devices) {
                if (d.kind !== "audioinput" || !d.deviceId) continue;
                if (seen.has(d.deviceId)) continue;
                seen.add(d.deviceId);
                inputs.push(d);
            }
            setMicDevices(inputs);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        void refreshMicDevices();
        const md = navigator.mediaDevices;
        if (!md) return;
        const onChange = () => void refreshMicDevices();
        md.addEventListener("devicechange", onChange);
        return () => md.removeEventListener("devicechange", onChange);
    }, [refreshMicDevices]);

    const stopMicTracks = useCallback(() => {
        if (statusRef.current === "recording") {
            recorder.stop();
            showNotice(
                "Mic berhenti - rekaman parsial tersimpan, silakan download.",
            );
        }
        if (audioPipelineRef.current) {
            audioPipelineRef.current.stop();
            audioPipelineRef.current = null;
        }
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        setMicStream(null);
        setMicOn(false);
    }, [recorder, showNotice]);

    const attachMic = useCallback(
        (stream: MediaStream) => {
            micStreamRef.current = stream;
            setMicStream(stream);
            setMicOn(true);
            const track = stream.getAudioTracks()[0];
            if (track) {
                track.onended = () => {
                    stopMicTracks();
                };
            }
        },
        [stopMicTracks],
    );

    const handleEnableMic = useCallback(async (deviceId?: string) => {
        setMediaError(null);
        const wanted = deviceId !== undefined ? deviceId : selectedMicId;
        try {
            if (audioPipelineRef.current) {
                audioPipelineRef.current.stop();
                audioPipelineRef.current = null;
            }
            const pipeline = await createEnhancedMicrophoneStream({
                deviceId: wanted,
                noiseSuppression,
                echoCancellation,
                autoGainControl,
                voiceEnhancer,
            });
            audioPipelineRef.current = pipeline;
            setMicLabel(pipeline.activeDeviceLabel);
            attachMic(pipeline.stream);
            await refreshMicDevices();
        } catch {
            setMediaError(
                "Unable to access the microphone. Check your system permissions and try again.",
            );
        }
    }, [
        selectedMicId,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        voiceEnhancer,
        attachMic,
        refreshMicDevices,
    ]);

    const switchMicDevice = useCallback(
        async (deviceId: string) => {
            setSelectedMicId(deviceId);
            if (!micStreamRef.current) return;
            setMediaError(null);
            try {
                if (audioPipelineRef.current) {
                    audioPipelineRef.current.stop();
                    audioPipelineRef.current = null;
                }
                const pipeline = await createEnhancedMicrophoneStream({
                    deviceId,
                    noiseSuppression,
                    echoCancellation,
                    autoGainControl,
                    voiceEnhancer,
                });
                audioPipelineRef.current = pipeline;
                setMicLabel(pipeline.activeDeviceLabel);
                attachMic(pipeline.stream);
                await refreshMicDevices();
            } catch {
                setMicStream(null);
                setMicOn(false);
                setMediaError(
                    "Unable to access the microphone. Check your system permissions and try again.",
                );
            }
        },
        [
            noiseSuppression,
            echoCancellation,
            autoGainControl,
            voiceEnhancer,
            attachMic,
            refreshMicDevices,
        ],
    );

    // Sinkronisasi Voice Enhancer real-time tanpa memutus stream
    useEffect(() => {
        audioPipelineRef.current?.setVoiceEnhancer(voiceEnhancer);
    }, [voiceEnhancer]);

    // Sinkronisasi Audio Constraints (Noise Suppression, Echo Cancellation, AGC) real-time
    useEffect(() => {
        void audioPipelineRef.current?.updateConstraints({
            noiseSuppression,
            echoCancellation,
            autoGainControl,
        });
    }, [noiseSuppression, echoCancellation, autoGainControl]);

    const handleStopMic = useCallback(() => {
        stopMicTracks();
    }, [stopMicTracks]);

    // --- Scene sebagai profil perangkat -------------------------------
    const lastSceneIdRef = useRef<string | null>(null);
    const sceneInitRef = useRef(true);
    // Snapshot state perangkat terakhir yang diketahui — dipakai supaya
    // run pertama saat mount tidak menimpa profil scene tersimpan dengan
    // nilai default (semua off).
    const deviceSnapshotRef = useRef<{
        cameraOn: boolean;
        micOn: boolean;
        micDeviceId: string;
        mirror: boolean;
    } | null>(null);
    // Scene yang devices-nya tertunda di-apply karena rekaman sedang
    // berjalan (track mic sudah baked ke stream rekaman — hanya aman
    // diganti setelah rekaman berakhir).
    const pendingSceneRef = useRef<Scene | null>(null);

    const applySceneDevices = useCallback(
        async (dev: SceneDevices) => {
            setMirror(dev.mirror);
            if (dev.cameraOn && !cameraStreamRef.current) {
                await handleEnableCamera();
            } else if (!dev.cameraOn && cameraStreamRef.current) {
                handleStopCamera();
            }
            if (dev.micOn && !micStreamRef.current) {
                setSelectedMicId(dev.micDeviceId);
                await handleEnableMic(dev.micDeviceId);
            } else if (!dev.micOn && micStreamRef.current) {
                handleStopMic();
            } else if (
                dev.micOn &&
                micStreamRef.current &&
                dev.micDeviceId &&
                dev.micDeviceId !== selectedMicId
            ) {
                await switchMicDevice(dev.micDeviceId);
            }
        },
        [
            handleEnableCamera,
            handleStopCamera,
            handleEnableMic,
            handleStopMic,
            switchMicDevice,
            selectedMicId,
        ],
    );

    // Apply devices scene saat user berpindah tab. Saat mount TIDAK
    // di-apply — bisa memicu prompt izin kamera/mic waktu app dibuka.
    useEffect(() => {
        const scene = useStore.getState().currentScene;
        if (!scene) return;
        if (sceneInitRef.current) {
            sceneInitRef.current = false;
            lastSceneIdRef.current = scene.id;
            return;
        }
        if (lastSceneIdRef.current === scene.id) return;
        lastSceneIdRef.current = scene.id;
        if (statusRef.current === "recording") {
            pendingSceneRef.current = scene;
            return;
        }
        pendingSceneRef.current = null;
        if (scene.devices) void applySceneDevices(scene.devices);
    }, [currentScene?.id, applySceneDevices]);

    // Ganti tab saat rekaman tetap berganti tampilan, tetapi kamera/mic
    // baru diterapkan setelah rekaman berakhir (audio rekaman memakai
    // track mic yang sudah direkam sejak awal).
    useEffect(() => {
        if (recording) return;
        const pending = pendingSceneRef.current;
        if (!pending) return;
        pendingSceneRef.current = null;
        if (pending.id !== useStore.getState().currentScene?.id) return;
        if (pending.devices) void applySceneDevices(pending.devices);
    }, [recording, applySceneDevices]);

    // Auto-save kamera/mic/mirror ke scene aktif — hanya saat nilai
    // berubah dari snapshot terakhir, dan tidak sedang rekaman.
    useEffect(() => {
        const snap = {
            cameraOn,
            micOn,
            micDeviceId: selectedMicId,
            mirror,
        };
        const prev = deviceSnapshotRef.current;
        deviceSnapshotRef.current = snap;
        if (!prev) return; // baseline saat mount — jangan tulis
        if (
            prev.cameraOn === snap.cameraOn &&
            prev.micOn === snap.micOn &&
            prev.micDeviceId === snap.micDeviceId &&
            prev.mirror === snap.mirror
        )
            return;
        if (statusRef.current === "recording") return;
        const scene = useStore.getState().currentScene;
        if (!scene) return;
        useStore.getState().updateScene(scene.id, {
            devices: snap,
        });
    }, [cameraOn, micOn, selectedMicId, mirror]);

    const handleStartSession = useCallback(() => {
        setIsSessionActive(true);
        void enterFullscreen();
    }, [setIsSessionActive, enterFullscreen]);

    const handleEndSession = useCallback(() => {
        setIsSessionActive(false);
        setIsFullscreen(false);
        void exitFullscreen();
    }, [setIsSessionActive, setIsFullscreen, exitFullscreen]);

    const presentation = isFullscreen || isSessionActive;
    const hasScreen = screenOn;

    const screenPreview = (
        <Card className="w-full min-h-0 flex-1 py-0">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                {hasScreen ? (
                    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-md bg-muted">
                        <video
                            ref={attachScreenVideo}
                            autoPlay
                            muted
                            playsInline
                            className={`absolute inset-0 size-full transition-all duration-200 ${
                                screenFit === "cover"
                                    ? "object-cover"
                                    : "object-contain"
                            }`}
                        />
                        <div
                            ref={stallOverlayRef}
                            style={{ display: "none" }}
                            className="absolute top-3 right-3 z-20 flex max-w-sm items-center gap-2.5 rounded-lg border border-amber-500/40 bg-background/95 p-3 text-xs shadow-lg backdrop-blur-md"
                        >
                            <MonitorOff className="size-5 shrink-0 text-amber-500" />
                            <div className="flex flex-col gap-1">
                                <span className="font-semibold text-foreground">
                                    Layar terdeteksi putih
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    Di Wayland, jendela yang tertutup jendela lain bisa terkirim sebagai layar putih.
                                </span>
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                            void handleShareScreen()
                                        }
                                    >
                                        Pilih ulang
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => {
                                            whiteDismissedRef.current =
                                                true;
                                            if (stallOverlayRef.current)
                                                stallOverlayRef.current.style.display =
                                                    "none";
                                        }}
                                    >
                                        Abaikan
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 overflow-hidden rounded-md bg-muted">
                        <Empty className="h-full w-full border-0">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <MonitorUp />
                                </EmptyMedia>
                                <EmptyTitle>No content source</EmptyTitle>
                                <EmptyDescription>
                                    Choose a screen to begin. Siap direkam HD -
                                    layar + kamera digabung saat Record.
                                </EmptyDescription>
                            </EmptyHeader>
                            {!presentation && (
                                <Button
                                    size="sm"
                                    onClick={() => void handleShareScreen()}
                                >
                                    <MonitorUp /> Share screen
                                </Button>
                            )}
                        </Empty>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const cameraCard = (
        <Card size="sm">
            <CardHeader>
                <CardTitle>Kamera & Mic</CardTitle>
                <CardAction>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label={
                                micOn ? "Mic menyala" : "Mic mati"
                            }
                            title={
                                micOn
                                    ? "Mic menyala — klik untuk mematikan"
                                    : "Mic mati — klik untuk mengaktifkan"
                            }
                            onClick={() =>
                                micOn
                                    ? handleStopMic()
                                    : void handleEnableMic()
                            }
                        >
                            {micOn ? <Mic /> : <MicOff />}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label={
                                cameraOn ? "Kamera menyala" : "Kamera mati"
                            }
                            title={
                                cameraOn
                                    ? "Kamera menyala — klik untuk mematikan"
                                    : "Kamera mati — klik untuk mengaktifkan"
                            }
                            onClick={() =>
                                cameraOn
                                    ? handleStopCamera()
                                    : void handleEnableCamera()
                            }
                        >
                            {cameraOn ? <Camera /> : <CameraOff />}
                        </Button>
                    </div>
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
                <AspectRatio
                    ratio={16 / 9}
                    className="overflow-hidden rounded-md bg-muted"
                >
                    {cameraOn ? (
                        <video
                            ref={attachCameraVideo}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover"
                            style={
                                mirror ? { transform: "scaleX(-1)" } : undefined
                            }
                        />
                    ) : (
                        <button
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => void handleEnableCamera()}
                        >
                            <Camera className="size-5" />
                            <span className="text-xs">Aktifkan kamera</span>
                        </button>
                    )}
                    <span
                        title={cameraOn ? "Live" : "Kamera mati"}
                        className={`absolute top-2 right-2 z-10 size-2.5 rounded-full ${
                            cameraOn
                                ? "animate-pulse bg-destructive"
                                : "bg-muted-foreground"
                        }`}
                    />
                </AspectRatio>
                <div className="flex items-center justify-between">
                    <Label htmlFor="mirror">Mirror</Label>
                    <Switch
                        id="mirror"
                        checked={mirror}
                        onCheckedChange={setMirror}
                    />
                </div>
                {micOn && (
                    <div className="flex items-center gap-2">
                        <MicLevelMeter stream={micStream} />
                        <span
                            className="max-w-[50%] truncate text-[11px] text-muted-foreground"
                            title={
                                micLabel ||
                                micStream?.getAudioTracks()[0]?.label ||
                                "Mic"
                            }
                        >
                            {micLabel ||
                                micStream?.getAudioTracks()[0]?.label ||
                                "Mic aktif"}
                        </span>
                    </div>
                )}
                {/* Audio Anti-Noise & Voice Processing */}
                <div className="space-y-2 border-t border-border/60 pt-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-primary" />
                            <Label
                                htmlFor="noise-suppression"
                                className="cursor-pointer text-xs font-medium"
                            >
                                Anti-Noise (Peredam Bising)
                            </Label>
                        </div>
                        <Switch
                            id="noise-suppression"
                            checked={noiseSuppression}
                            onCheckedChange={setNoiseSuppression}
                        />
                    </div>

                    <Popover>
                        <PopoverTrigger
                            className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                                "h-7 w-full justify-between px-2 text-xs text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <span className="flex items-center gap-1.5">
                                <SlidersHorizontal className="size-3.5" />
                                Filter & EQ Suara
                            </span>
                            <Badge variant="outline" className="h-4.5 px-1.5 text-[10px]">
                                {voiceEnhancer ? "Enhanced" : "Standard"}
                            </Badge>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 space-y-3" side="left" align="start">
                            <PopoverHeader>
                                <PopoverTitle className="flex items-center gap-1.5 text-sm">
                                    <Volume2 className="size-4 text-primary" />
                                    Filter & Pengaturan Suara
                                </PopoverTitle>
                                <PopoverDescription className="text-xs">
                                    Sesuaikan pemrosesan audio untuk rekaman suara jernih tanpa dengung.
                                </PopoverDescription>
                            </PopoverHeader>
                            <div className="space-y-3 pt-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col pr-2">
                                        <Label htmlFor="pop-voice-enhancer" className="cursor-pointer text-xs font-medium">
                                            Voice Enhancer & Anti-Rumble
                                        </Label>
                                        <span className="text-[10px] text-muted-foreground">
                                            Memotong dengung (&lt;85Hz), meratakan volume &amp; perjelas vokal
                                        </span>
                                    </div>
                                    <Switch
                                        id="pop-voice-enhancer"
                                        checked={voiceEnhancer}
                                        onCheckedChange={setVoiceEnhancer}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col pr-2">
                                        <Label htmlFor="pop-echo-cancel" className="cursor-pointer text-xs font-medium">
                                            Echo Cancellation
                                        </Label>
                                        <span className="text-[10px] text-muted-foreground">
                                            Mencegah gema dan feedback suara dari speaker
                                        </span>
                                    </div>
                                    <Switch
                                        id="pop-echo-cancel"
                                        checked={echoCancellation}
                                        onCheckedChange={setEchoCancellation}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col pr-2">
                                        <Label htmlFor="pop-auto-gain" className="cursor-pointer text-xs font-medium">
                                            Auto Gain Control
                                        </Label>
                                        <span className="text-[10px] text-muted-foreground">
                                            Otomatis menyesuaikan dan menstabilkan volume input mic
                                        </span>
                                    </div>
                                    <Switch
                                        id="pop-auto-gain"
                                        checked={autoGainControl}
                                        onCheckedChange={setAutoGainControl}
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardContent>
        </Card>
    );

    // Bagian kontrol: mentok di bawah sidebar, tidak ikut scroll, dan
    // tetap tampil selama record (sesuai keputusan: kontrol boleh
    // terekam di pojok kanan bawah video).
    const controlCard = (
        <Card size="sm" className="shrink-0">
            <CardContent className="space-y-3">
                <div className="space-y-1.5">
                    <Label htmlFor="mic-device">Mic input</Label>
                    <Select
                        value={selectedMicId || "default"}
                        onValueChange={(v) =>
                            void switchMicDevice(
                                v === "default" ? "" : String(v),
                            )
                        }
                        disabled={recording}
                    >
                        <SelectTrigger
                            id="mic-device"
                            size="sm"
                            className="w-full"
                            title={
                                recording
                                    ? "Hentikan rekaman dulu untuk ganti mic"
                                    : "Pilih device input mic"
                            }
                        >
                            <SelectValue>
                                {(v: string | null) =>
                                    v && v !== "default"
                                        ? micDevices.find(
                                                  (d) => d.deviceId === v,
                                              )?.label || "Input device"
                                        : "Default device"
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent side="top" align="start">
                            <SelectItem value="default">
                                Default device
                            </SelectItem>
                            {micDevices.map((d, i) => (
                                <SelectItem
                                    key={d.deviceId || `input-${i}`}
                                    value={d.deviceId}
                                >
                                    {d.label || `Input device ${i + 1}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {micDevices.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                            Aktifkan mic dulu untuk melihat daftar device.
                        </p>
                    )}
                    <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                            <ShieldCheck
                                className={`size-3.5 ${
                                    noiseSuppression
                                        ? "text-emerald-500"
                                        : "text-muted-foreground"
                                }`}
                            />
                            {noiseSuppression
                                ? "Anti-Noise aktif"
                                : "Anti-Noise nonaktif"}
                        </span>
                        {voiceEnhancer && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                Vocal Boost ON
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {recording ? (
                        <Badge variant="destructive">
                            <span className="size-1.5 animate-pulse rounded-full bg-current" />
                            REC{" "}
                            {`${String(Math.floor(recorder.elapsedMs / 60000)).padStart(2, "0")}:${String(Math.floor((recorder.elapsedMs % 60000) / 1000)).padStart(2, "0")}`}
                        </Badge>
                    ) : null}
                    {recording ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => recorder.stop()}
                        >
                            <Square /> Stop
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            onClick={() => recorder.start()}
                            disabled={!cameraOn && !hasScreen}
                            title={
                                !cameraOn && !hasScreen
                                    ? "Aktifkan kamera atau pilih screen untuk merekam"
                                    : "Record HD"
                            }
                        >
                            <Circle className="fill-current" /> Record HD
                        </Button>
                    )}
                    {isSessionActive && (
                        <Button
                            size="sm"
                            variant="destructive"
                            title="End session (Esc)"
                            aria-label="End session"
                            onClick={handleEndSession}
                        >
                            <Square /> End
                        </Button>
                    )}
                    {(recorder.blobUrl || recorder.filePath) && !recording && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto"
                            onClick={() => {
                                if (recorder.filePath) {
                                    void saveRecordedFile(
                                        recorder.filePath,
                                        recorder.fileName,
                                    );
                                } else if (recorder.blobUrl) {
                                    void downloadRecording(
                                        recorder.blobUrl,
                                        recorder.fileName,
                                    );
                                }
                            }}
                        >
                            <Download /> .{fileExt}
                        </Button>
                    )}
                </div>
                {!recording && (
                    <p className="text-[11px] text-muted-foreground">
                        {!cameraOn && !hasScreen ? (
                            "Pilih screen atau aktifkan kamera untuk Record."
                        ) : (
                            <>
                                {currentScene
                                    ? `Scene: ${currentScene.name}`
                                    : "Editor mode"}
                                {" · Suara layar "}
                                {screenAudioOn ? "on" : "off"}
                                {" · Mic "}
                                {micOn ? "on" : "off"} · Output .{fileExt} ·
                                Esc stop
                            </>
                        )}
                    </p>
                )}
            </CardContent>
        </Card>
    );

    // Sidebar kanan: About + Kamera (bisa scroll) di atas, bagian kontrol
    // mentok di bawah tanpa ikut scroll.
    const sidebar = (
        <aside className="flex min-h-0 w-[300px] shrink-0 flex-col border-l border-border">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                <AboutPanel />
                {cameraCard}
            </div>
            <div className="shrink-0 border-t border-border p-4">
                {controlCard}
            </div>
        </aside>
    );

    if (presentation) {
        return (
            <div className="flex h-screen w-screen overflow-hidden bg-background">
                <div className="flex min-h-0 min-w-0 flex-1">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Tabs
                                value={currentScene?.id ?? ""}
                                onValueChange={(v) => switchScene(v)}
                            >
                                <TabsList>
                                    {scenes.map((scene, i) => (
                                        <TabsTrigger
                                            key={scene.id}
                                            value={scene.id}
                                        >
                                            {i + 1}. {scene.name}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                            <div className="ml-auto flex flex-wrap items-center gap-2 no-record">
                                {screenOn && (
                                    <Button
                                        size="sm"
                                        variant={
                                            screenFit === "cover"
                                                ? "secondary"
                                                : "outline"
                                        }
                                        onClick={() =>
                                            setScreenFit(
                                                screenFit === "cover"
                                                    ? "contain"
                                                    : "cover",
                                            )
                                        }
                                        title={
                                            screenFit === "cover"
                                                ? "Tampilan Layar: Penuhi Layar (Cover) — Klik untuk Rasio Asli (Fit)"
                                                : "Tampilan Layar: Rasio Asli (Fit) — Klik untuk Penuhi Layar (Cover)"
                                        }
                                    >
                                        <Scaling className="size-4" />
                                        <span className="hidden sm:inline">
                                            {screenFit === "cover"
                                                ? "Full / Cover"
                                                : "Fit / Rasio Asli"}
                                        </span>
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant={
                                        sidebarCollapsed
                                            ? "secondary"
                                            : "outline"
                                    }
                                    onClick={() =>
                                        setSidebarCollapsed(!sidebarCollapsed)
                                    }
                                    title={
                                        sidebarCollapsed
                                            ? "Buka Sidebar (Kamera & Kontrol)"
                                            : "Sembunyikan Sidebar (Full View)"
                                    }
                                >
                                    {sidebarCollapsed ? (
                                        <PanelRightOpen className="size-4" />
                                    ) : (
                                        <PanelRightClose className="size-4" />
                                    )}
                                    <span className="hidden sm:inline">
                                        {sidebarCollapsed
                                            ? "Buka Sidebar"
                                            : "Full View"}
                                    </span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant={screenOn ? "outline" : "default"}
                                    onClick={() => void handleShareScreen()}
                                >
                                    <MonitorUp className="size-4" />{" "}
                                    {screenOn ? "Ganti screen" : "Select screen"}
                                </Button>
                                {screenOn && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleStopScreen}
                                    >
                                        <MonitorOff className="size-4" /> Stop screen
                                    </Button>
                                )}
                            </div>
                        </div>
                        {screenPreview}
                        <TechMarquee />
                    </div>
                    {!sidebarCollapsed && (
                        <div className="flex min-h-0 w-[280px] shrink-0 flex-col border-l border-border">
                            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                                <AboutPanel clean />
                                {cameraCard}
                            </div>
                            <div className="shrink-0 border-t border-border p-4">
                                {controlCard}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
            <header className="flex items-center justify-between gap-4 px-4 py-2 sm:px-4">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                        Creator Screen
                    </h1>
                </div>
                <div className="flex gap-2 no-record">
                    <ThemeToggle />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize /> : <Maximize />}
                        {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    </Button>
                    {isSessionActive ? (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleEndSession}
                        >
                            <Square /> End session
                        </Button>
                    ) : (
                        <Button size="sm" onClick={handleStartSession}>
                            <Play /> Start session
                        </Button>
                    )}
                </div>
            </header>
            <Separator />

            {mediaError && (
                <div className="px-4 pt-4 sm:px-4">
                    <Alert variant="destructive">
                        <AlertTitle>Something went wrong</AlertTitle>
                        <AlertDescription>{mediaError}</AlertDescription>
                        <AlertAction>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMediaError(null)}
                            >
                                Dismiss
                            </Button>
                        </AlertAction>
                    </Alert>
                </div>
            )}

            <AlertDialog
                open={recorder.error !== null}
                onOpenChange={(open) => {
                    if (!open) recorder.clearError();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Recording gagal</AlertDialogTitle>
                        <AlertDialogDescription>
                            {recorder.error}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Mengerti</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={recordNotice !== null}
                onOpenChange={(open) => {
                    if (!open) setRecordNotice(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{recordNoticeTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {recordNotice}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        {recorder.blobUrl && (
                            <AlertDialogAction
                                onClick={() => {
                                    if (recorder.blobUrl) {
                                        downloadRecording(
                                            recorder.blobUrl,
                                            recorder.fileName,
                                        );
                                    }
                                    setRecordNotice(null);
                                }}
                            >
                                Download .{fileExt}
                            </AlertDialogAction>
                        )}
                        <AlertDialogCancel>Mengerti</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex min-h-0 flex-1">
                <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 gap-0">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <Tabs
                                    value={currentScene?.id ?? ""}
                                    onValueChange={(v) => switchScene(v)}
                                >
                                    <TabsList>
                                        {scenes.map((scene, i) => (
                                            <TabsTrigger
                                                key={scene.id}
                                                value={scene.id}
                                            >
                                                {i + 1}. {scene.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                                <div className="ml-auto flex flex-wrap items-center gap-2 no-record">
                                    {screenOn && (
                                        <Button
                                            size="sm"
                                            variant={
                                                screenFit === "cover"
                                                    ? "secondary"
                                                    : "outline"
                                            }
                                            onClick={() =>
                                                setScreenFit(
                                                    screenFit === "cover"
                                                        ? "contain"
                                                        : "cover",
                                                )
                                            }
                                            title={
                                                screenFit === "cover"
                                                    ? "Tampilan Layar: Penuhi Layar (Cover) — Klik untuk Rasio Asli (Fit)"
                                                    : "Tampilan Layar: Rasio Asli (Fit) — Klik untuk Penuhi Layar (Cover)"
                                            }
                                        >
                                            <Scaling className="size-4" />
                                            <span className="hidden sm:inline">
                                                {screenFit === "cover"
                                                    ? "Full / Cover"
                                                    : "Fit / Rasio Asli"}
                                            </span>
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant={
                                            sidebarCollapsed
                                                ? "secondary"
                                                : "outline"
                                        }
                                        onClick={() =>
                                            setSidebarCollapsed(
                                                !sidebarCollapsed,
                                            )
                                        }
                                        title={
                                            sidebarCollapsed
                                                ? "Buka Sidebar (Kamera & Kontrol)"
                                                : "Sembunyikan Sidebar (Full View)"
                                        }
                                    >
                                        {sidebarCollapsed ? (
                                            <PanelRightOpen className="size-4" />
                                        ) : (
                                            <PanelRightClose className="size-4" />
                                        )}
                                        <span className="hidden sm:inline">
                                            {sidebarCollapsed
                                                ? "Buka Sidebar"
                                                : "Full View"}
                                        </span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={
                                            screenOn ? "outline" : "default"
                                        }
                                        onClick={() =>
                                            void handleShareScreen()
                                        }
                                    >
                                        <MonitorUp className="size-4" />{" "}
                                        {screenOn
                                            ? "Ganti screen"
                                            : "Select screen"}
                                    </Button>
                                    {screenOn && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleStopScreen}
                                        >
                                            <MonitorOff className="size-4" /> Stop screen
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {screenPreview}
                            <TechMarquee editable />
                        </div>
                        {!sidebarCollapsed && sidebar}
                    </div>
                </main>
            </div>
        </div>
    );
}
