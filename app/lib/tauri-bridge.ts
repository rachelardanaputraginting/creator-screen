/**
 * Tauri bridge shim — populates `window.creatorScreen` so the renderer talks
 * to the Rust backend through the same interface the Electron preload used.
 *
 * The contract in `types/electron.d.ts` (`CreatorScreenBridge`) stays
 * unchanged; only the implementation swaps from Electron IPC to Tauri
 * commands (`invoke`) and events (`listen`).
 *
 * Loaded as a side-effect import in `app/(app)/app/page.tsx` before the
 * editor mounts, so `window.creatorScreen` is available before any component
 * that reads it.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CreatorScreenBridge } from "@/types/electron";

function isTauri(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function detectPlatform(): NodeJS.Platform {
    if (typeof navigator === "undefined") return "linux";
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "win32";
    if (ua.includes("mac")) return "darwin";
    return "linux";
}

function installBridge() {
    if (!isTauri()) return;
    if (window.creatorScreen) return; // already installed

    const bridge: CreatorScreenBridge = {
        isElectron: true,
        platform: detectPlatform(),

        setCapturePurpose: (purpose) => {
            void invoke("set_capture_purpose", { purpose });
        },

        // Tauri `listen` returns a Promise<unlisten>. The renderer's
        // CaptureSourcePicker expects `onPickerRequest` to return a synchronous
        // cleanup function, so we buffer the unlisten and return a wrapper
        // that calls it once available.
        onPickerRequest: (cb) => {
            let unlisten: (() => void) | null = null;

            void listen<{ id: string; name: string; kind: string; thumbnail: string | null }[]>(
                "picker:request",
                (event) => {
                    const payload = (event.payload ?? []).map((s) => ({
                        id: s.id,
                        name: s.name,
                        kind: (s.kind === "window" ? "window" : "screen") as
                            | "screen"
                            | "window",
                        thumbnail: s.thumbnail,
                    }));
                    cb(payload);
                },
            ).then((un) => {
                unlisten = un;
            });

            return () => {
                if (unlisten) unlisten();
            };
        },

        selectSource: (id) => {
            void invoke("select_source", { id });
        },

        saveRecording: async (data, fileName) => {
            const result = await invoke<{
                saved: boolean;
                path?: string;
                canceled?: boolean;
            }>("save_recording", {
                data: Array.from(data),
                fileName,
            });
            return result;
        },
    };

    window.creatorScreen = bridge;

    // Asynchronously refine with the exact platform reported by backend
    void invoke<string>("get_platform").then((p) => {
        bridge.platform = p as NodeJS.Platform;
    });
}

// Install immediately (side-effect import). Non-Tauri environments (web
// deployment, Electron) are skipped — the Electron preload still owns the
// bridge there.
installBridge();

export {};
