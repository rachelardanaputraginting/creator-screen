"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/stores/canvas-store";
import type { Scene, SceneDevices } from "@/types/scene";
import { BackgroundType } from "@/types/scene";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

interface SceneScreen {
    stream: MediaStream;
    audioOn: boolean;
    label: string;
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
    } = useStore();

    const [mediaError, setMediaError] = useState<string | null>(null);
    const [recordNotice, setRecordNotice] = useState<string | null>(null);
    const [recordNoticeTitle, setRecordNoticeTitle] = useState(
        "Rekaman tersimpan",
    );
    // Screen aktif PER SCENE — tiap scene memilih source-nya sendiri
    // lewat picker browser (beberapa share boleh hidup bersamaan).
    const [screensByScene, setScreensByScene] = useState<
        Record<string, SceneScreen>
    >({});
    const screensBySceneRef = useRef<Record<string, SceneScreen>>({});
    const currentSceneId = currentScene?.id ?? "";
    const activeScreen = screensByScene[currentSceneId];
    const screenOn = !!activeScreen;
    const screenAudioOn = activeScreen?.audioOn ?? false;
    const [cameraOn, setCameraOn] = useState(false);
    const [micOn, setMicOn] = useState(false);
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicId, setSelectedMicId] = useState("");
    const [mirror, setMirror] = useState(true);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
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
        screenStreamRef,
    });
    const recording = recorder.status === "recording";
    const fileExt = recorder.fileName.endsWith(".mp4") ? "mp4" : "webm";
    const statusRef = useRef(recorder.status);
    statusRef.current = recorder.status;

    const downloadRecording = useCallback((url: string, name: string) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }, []);

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
        },
        [],
    );

    const handleShareScreen = useCallback(async () => {
        setMediaError(null);
        const sceneId = useStore.getState().currentScene?.id;
        if (!sceneId) return;
        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                setMediaError(
                    "Screen capture is not supported in this browser. Try Chrome or Edge on desktop.",
                );
                return;
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
                systemAudio: "include",
            } as DisplayMediaStreamOptions);
            // Hasil picker menjadi screen milik scene AKTIF; stream lama
            // scene ini (kalau ada) dimatikan.
            const entry: SceneScreen = {
                stream,
                audioOn: stream.getAudioTracks().length > 0,
                label:
                    stream.getVideoTracks()[0]?.label || "Screen capture",
            };
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
                showNotice(
                    'Saat memilih layar, pilih "Entire Screen" lalu centang "Share system audio" supaya suara komputer ikut terekam. Tanpa itu rekaman hanya berisi suara mic.',
                    "Suara komputer belum ikut",
                );
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
        } catch {
            setMediaError(
                "Unable to access this screen. Check your system permissions and try again.",
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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, facingMode: "user" },
                audio: false,
            });
            cameraStreamRef.current = stream;
            setCameraOn(true);
            stream.getVideoTracks()[0]?.addEventListener("ended", () => {
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
            if (!navigator.mediaDevices?.getUserMedia) {
                setMediaError("Microphone is not supported in this browser.");
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: wanted ? { deviceId: { exact: wanted } } : true,
            });
            attachMic(stream);
            await refreshMicDevices();
        } catch {
            setMediaError(
                "Unable to access the microphone. Check your system permissions and try again.",
            );
        }
    }, [selectedMicId, attachMic, refreshMicDevices]);

    const switchMicDevice = useCallback(
        async (deviceId: string) => {
            setSelectedMicId(deviceId);
            if (!micStreamRef.current) return;
            setMediaError(null);
            micStreamRef.current.getTracks().forEach((t) => t.stop());
            micStreamRef.current = null;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: deviceId
                        ? { deviceId: { exact: deviceId } }
                        : true,
                });
                attachMic(stream);
                await refreshMicDevices();
            } catch {
                setMicStream(null);
                setMicOn(false);
                setMediaError(
                    "Unable to access the microphone. Check your system permissions and try again.",
                );
            }
        },
        [attachMic, refreshMicDevices],
    );

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
            <CardContent className="min-h-0 flex-1 p-0">
                <AspectRatio
                    ratio={16 / 9}
                    className="h-full w-full overflow-hidden rounded-md bg-muted"
                >
                    {hasScreen ? (
                        <video
                            ref={attachScreenVideo}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full object-contain"
                        />
                    ) : (
                        <Empty className="h-full border-0">
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
                    )}
                </AspectRatio>
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
                                micStream?.getAudioTracks()[0]?.label || "Mic"
                            }
                        >
                            {micStream?.getAudioTracks()[0]?.label ||
                                "Mic aktif"}
                        </span>
                    </div>
                )}
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
                            disabled={!cameraOn || !hasScreen}
                            title={
                                !cameraOn && !hasScreen
                                    ? "Aktifkan kamera dan share screen dulu"
                                    : !cameraOn
                                      ? "Aktifkan kamera dulu"
                                      : !hasScreen
                                        ? "Share screen dulu"
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
                    {recorder.blobUrl && !recording && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto"
                            onClick={() =>
                                recorder.blobUrl &&
                                downloadRecording(
                                    recorder.blobUrl,
                                    recorder.fileName,
                                )
                            }
                        >
                            <Download /> .{fileExt}
                        </Button>
                    )}
                </div>
                {!recording && (
                    <p className="text-[11px] text-muted-foreground">
                        {!cameraOn || !hasScreen ? (
                            <>
                                {!cameraOn && !hasScreen
                                    ? "Aktifkan kamera + share screen untuk Record."
                                    : !cameraOn
                                      ? "Aktifkan kamera untuk Record."
                                      : "Share screen dulu untuk Record."}
                            </>
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
                            <div className="ml-auto flex gap-2 no-record">
                                <Button
                                    size="sm"
                                    variant={screenOn ? "outline" : "default"}
                                    onClick={() => void handleShareScreen()}
                                >
                                    <MonitorUp />{" "}
                                    {screenOn ? "Ganti screen" : "Select screen"}
                                </Button>
                                {screenOn && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleStopScreen}
                                    >
                                        <MonitorOff /> Stop screen
                                    </Button>
                                )}
                            </div>
                        </div>
                        {screenPreview}
                        <TechMarquee />
                    </div>
                    <div className="flex min-h-0 w-[280px] shrink-0 flex-col border-l border-border">
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                            <AboutPanel clean />
                            {cameraCard}
                        </div>
                        <div className="shrink-0 border-t border-border p-4">
                            {controlCard}
                        </div>
                    </div>
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
                                <div className="ml-auto flex gap-2 no-record">
                                    <Button
                                        size="sm"
                                        variant={
                                            screenOn ? "outline" : "default"
                                        }
                                        onClick={() =>
                                            void handleShareScreen()
                                        }
                                    >
                                        <MonitorUp />{" "}
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
                                            <MonitorOff /> Stop screen
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {screenPreview}
                            <TechMarquee />
                        </div>
                        {sidebar}
                    </div>
                </main>
            </div>
        </div>
    );
}
