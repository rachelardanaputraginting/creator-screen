"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/stores/canvas-store";
import type { Scene } from "@/types/scene";
import { BackgroundType } from "@/types/scene";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
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
import AboutPanel from "./about-panel";
import TechMarquee from "./tech-marquee";
import ThemeToggle from "./theme-toggle";
import { useCompositeRecorder } from "@/app/hooks/use-composite-recorder";
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
        },
        {
            id: "terminal",
            name: "Terminal",
            source: { ...screen, id: "source-terminal", label: "Terminal" },
            overlays: [],
            background: BackgroundType.Solid,
            canvasWidth: 1920,
            canvasHeight: 1080,
        },
        {
            id: "presentation",
            name: "Presentation",
            source: { ...screen, id: "source-presentation", label: "Deck" },
            overlays: [],
            background: BackgroundType.Solid,
            canvasWidth: 1920,
            canvasHeight: 1080,
        },
    ];
}

export default function EditorLayout() {
    const {
        source,
        setSource,
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
    const [screenOn, setScreenOn] = useState(false);
    const [cameraOn, setCameraOn] = useState(false);
    const [micOn, setMicOn] = useState(false);
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [mirror, setMirror] = useState(true);
    const [screenVideoEl, setScreenVideoEl] = useState<HTMLVideoElement | null>(
        null,
    );
    const [cameraVideoEl, setCameraVideoEl] = useState<HTMLVideoElement | null>(
        null,
    );
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;
        const st = useStore.getState();
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
            if (e.key === "Escape" && useStore.getState().isSessionActive) {
                useStore.getState().setIsSessionActive(false);
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

    useEffect(() => {
        if (screenVideoRef.current && screenStreamRef.current) {
            screenVideoRef.current.srcObject = screenStreamRef.current;
            void screenVideoRef.current.play().catch(() => {});
        }
    }, [screenOn, source?.type]);

    useEffect(() => {
        if (cameraVideoRef.current && cameraStreamRef.current) {
            cameraVideoRef.current.srcObject = cameraStreamRef.current;
            void cameraVideoRef.current.play().catch(() => {});
        }
    }, [cameraOn]);

    const recorder = useCompositeRecorder({
        screenVideo: screenVideoEl,
        cameraVideo: cameraVideoEl,
        mirror,
        micStream,
    });
    const recording = recorder.status === "recording";
    const statusRef = useRef(recorder.status);
    statusRef.current = recorder.status;

    const attachScreenVideo = useCallback((node: HTMLVideoElement | null) => {
        screenVideoRef.current = node;
        setScreenVideoEl(node);
    }, []);

    const attachCameraVideo = useCallback((node: HTMLVideoElement | null) => {
        cameraVideoRef.current = node;
        setCameraVideoEl(node);
    }, []);

    const stageRef = useRef<HTMLElement | null>(null);
    const attachStage = useCallback((node: HTMLElement | null) => {
        stageRef.current = node;
    }, []);

    const downloadRecording = useCallback((url: string, name: string) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }, []);

    const prevBlobUrl = useRef<string | null>(null);
    useEffect(() => {
        if (recorder.blobUrl && recorder.blobUrl !== prevBlobUrl.current) {
            prevBlobUrl.current = recorder.blobUrl;
            downloadRecording(recorder.blobUrl, recorder.fileName);
        }
    }, [recorder.blobUrl, recorder.fileName, downloadRecording]);

    const stopScreenTracks = useCallback(() => {
        if (statusRef.current === "recording") {
            recorder.stop();
            setRecordNotice(
                "Layar berhenti - rekaman parsial tersimpan, silakan download.",
            );
        }
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setScreenOn(false);
    }, [recorder]);

    const stopCameraTracks = useCallback(() => {
        if (statusRef.current === "recording") {
            recorder.stop();
            setRecordNotice(
                "Kamera berhenti - rekaman parsial tersimpan, silakan download.",
            );
        }
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
        setCameraOn(false);
    }, [recorder]);

    useEffect(
        () => () => {
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
            micStreamRef.current?.getTracks().forEach((t) => t.stop());
        },
        [],
    );

    const handleShareScreen = useCallback(async () => {
        setMediaError(null);
        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                setMediaError(
                    "Screen capture is not supported in this browser. Try Chrome or Edge on desktop.",
                );
                return;
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
            screenStreamRef.current = stream;
            setScreenOn(true);
            setSource({
                id: "source-screen",
                type: "screen",
                label: "Display 1",
                active: true,
            });
            stream.getVideoTracks()[0]?.addEventListener("ended", () => {
                stopScreenTracks();
                setSource(null);
            });
        } catch {
            setMediaError(
                "Unable to access this screen. Check your system permissions and try again.",
            );
        }
    }, [setSource, stopScreenTracks]);

    const handleStopScreen = useCallback(() => {
        stopScreenTracks();
        if (source?.type === "screen") setSource(null);
    }, [stopScreenTracks, source?.type, setSource]);

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

    const stopMicTracks = useCallback(() => {
        if (statusRef.current === "recording") {
            recorder.stop();
            setRecordNotice(
                "Mic berhenti - rekaman parsial tersimpan, silakan download.",
            );
        }
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        setMicStream(null);
        setMicOn(false);
    }, [recorder]);

    const handleEnableMic = useCallback(async () => {
        setMediaError(null);
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setMediaError("Microphone is not supported in this browser.");
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
            });
            micStreamRef.current = stream;
            setMicStream(stream);
            setMicOn(true);
            stream.getAudioTracks()[0]?.addEventListener("ended", () => {
                stopMicTracks();
            });
        } catch {
            setMediaError(
                "Unable to access the microphone. Check your system permissions and try again.",
            );
        }
    }, [stopMicTracks]);

    const handleStopMic = useCallback(() => {
        stopMicTracks();
    }, [stopMicTracks]);

    const handleStartSession = useCallback(() => {
        setIsSessionActive(true);
        void enterFullscreen();
    }, [setIsSessionActive, enterFullscreen]);

    const handleEndSession = useCallback(() => {
        setIsSessionActive(false);
        void exitFullscreen();
    }, [setIsSessionActive, exitFullscreen]);

    const presentation = isFullscreen || isSessionActive;
    const hasScreen = source?.type === "screen" && screenOn;

    const screenPreview = (
        <Card className="w-full py-0">
            <CardContent className="p-0">
                <AspectRatio
                    ratio={16 / 9}
                    className="overflow-hidden rounded-md h-fit bg-muted"
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
                <CardDescription>
                    {cameraOn ? "Live preview" : "Belum aktif"}
                </CardDescription>
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
                </AspectRatio>
                <div className="flex items-center justify-between gap-2">
                    <Badge variant={cameraOn ? "secondary" : "outline"}>
                        {cameraOn ? "Aktif" : "Mati"}
                    </Badge>
                    {cameraOn ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleStopCamera}
                        >
                            <CameraOff /> Matikan
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleEnableCamera()}
                        >
                            <Camera /> Aktifkan
                        </Button>
                    )}
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="mirror">Mirror</Label>
                    <Switch
                        id="mirror"
                        checked={mirror}
                        onCheckedChange={setMirror}
                    />
                </div>
                <div className="flex items-center justify-between gap-2">
                    <Badge variant={micOn ? "secondary" : "outline"}>
                        {micOn ? "Mic on" : "Mic off"}
                    </Badge>
                    {micOn ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleStopMic}
                        >
                            <MicOff /> Matikan mic
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleEnableMic()}
                        >
                            <Mic /> Aktifkan mic
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    const sidebar = (
        <aside className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto p-4">
            <AboutPanel />
            {cameraCard}
        </aside>
    );

    if (presentation) {
        return (
            <div className="flex h-screen w-screen bg-background">
                {isSessionActive && (
                    <div className="absolute left-4 top-3 z-20">
                        <Badge variant="destructive">Session active</Badge>
                    </div>
                )}
                <div
                    ref={attachStage}
                    className="flex min-w-0 flex-1"
                >
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                        {screenPreview}
                        <TechMarquee />
                    </div>
                    <Separator orientation="vertical" />
                    <div className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto p-4">
                        <AboutPanel clean />
                        {cameraCard}
                    </div>
                </div>
                <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
                    <Button variant="secondary" onClick={handleEndSession}>
                        <Square /> End session (Esc)
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-4">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                        Creator Screen
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Rekam layar + kamera gabungan 1080p langsung di browser.
                    </p>
                </div>
                <div className="flex gap-2">
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

            {recorder.error && (
                <div className="px-4 pt-4 sm:px-4">
                    <Alert variant="destructive">
                        <AlertTitle>Recording gagal</AlertTitle>
                        <AlertDescription>{recorder.error}</AlertDescription>
                        <AlertAction>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => recorder.clearError()}
                            >
                                Dismiss
                            </Button>
                        </AlertAction>
                    </Alert>
                </div>
            )}

            {recordNotice && (
                <div className="px-4 pt-4 sm:px-4">
                    <Alert>
                        <AlertDescription>{recordNotice}</AlertDescription>
                        <AlertAction>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRecordNotice(null)}
                            >
                                Dismiss
                            </Button>
                        </AlertAction>
                    </Alert>
                </div>
            )}

            <div className="flex min-h-[calc(100vh-140px)]">
                <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:px-4">
                    <div className="flex flex-wrap items-center gap-2">
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
                        <div className="ml-auto">
                            {screenOn ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleStopScreen}
                                >
                                    <MonitorOff /> Stop screen
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => void handleShareScreen()}
                                >
                                    <MonitorUp /> Select screen
                                </Button>
                            )}
                        </div>
                    </div>
                    <div
                        ref={attachStage}
                        className="flex min-w-0 flex-1 gap-4"
                    >
                        <div className="flex min-w-0 flex-1 flex-col gap-4">
                            {screenPreview}
                            <TechMarquee />
                        </div>
                        <Separator orientation="vertical" />
                        {sidebar}
                    </div>
                    <Card size="sm">
                        <CardContent className="flex flex-wrap items-center gap-2">
                            {recording ? (
                                <>
                                    <Badge variant="destructive">
                                        <span className="size-1.5 animate-pulse rounded-full bg-current" />
                                        REC{" "}
                                        {`${String(Math.floor(recorder.elapsedMs / 60000)).padStart(2, "0")}:${String(Math.floor((recorder.elapsedMs % 60000) / 1000)).padStart(2, "0")}`}
                                    </Badge>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => recorder.stop()}
                                    >
                                        <Square /> Stop
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        size="sm"
                                        onClick={() => recorder.start()}
                                        disabled={!screenOn || !cameraOn}
                                    >
                                        <Circle className="fill-current" />{" "}
                                        Record HD
                                    </Button>
                                    {(!screenOn || !cameraOn) && (
                                        <p className="text-xs text-muted-foreground">
                                            {!screenOn && !cameraOn
                                                ? "Aktifkan layar dan kamera untuk merekam."
                                                : !screenOn
                                                  ? "Aktifkan layar untuk merekam."
                                                  : "Aktifkan kamera untuk merekam."}
                                        </p>
                                    )}
                                    {!micOn && (screenOn || cameraOn) && (
                                        <p className="text-xs text-muted-foreground">
                                            Mic off - file tanpa suara.
                                        </p>
                                    )}
                                </>
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
                                    <Download /> Download .webm
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>

            <Separator />
            <footer className="flex items-center justify-between gap-4 px-4 py-2 text-sm text-muted-foreground sm:px-4">
                <span>
                    {isSessionActive
                        ? "Session active"
                        : currentScene
                          ? `Scene: ${currentScene.name}`
                          : "Editor mode"}
                </span>
                <span>Ctrl+1…4 switch · Ctrl+Shift+F fullscreen</span>
            </footer>
        </div>
    );
}
