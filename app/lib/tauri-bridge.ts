/**
 * Tauri bridge shim — populates `window.creatorScreen` so the renderer talks
 * to the Tauri Rust backend.
 *
 * The contract in `types/bridge.d.ts` (`CreatorScreenBridge`) defines
 * Tauri commands (`invoke`) and events (`listen`).
 *
 * Loaded as a side-effect import in `app/(app)/app/page.tsx` before the
 * editor mounts, so `window.creatorScreen` is available before any component
 * that reads it.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import type {
    CreatorScreenBridge,
    CaptureSource,
    RecordedScreenFile,
    SaveRecordingResult,
    StartRecordingResult,
} from "@/types/bridge";

/** Chunks are raw IPC bodies, so they can be several megabytes each. */
const WRITE_CHUNK_BYTES = 4 * 1024 * 1024;
const KNOWN_VIDEO_EXTENSIONS = ["mp4", "webm", "mkv"];

function isTauri(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return String(err ?? "kesalahan tidak diketahui");
}

/** The container the recorder produced, derived from the file name it chose. */
function containerExtension(fileName: string): "mp4" | "webm" {
    return /\.mp4$/i.test(fileName.trim()) ? "mp4" : "webm";
}

/**
 * Make sure the saved file carries an extension that matches its bytes.
 *
 * GTK/XDG dialogs can drop the extension when the user does not type one, and
 * a `.mp4` name on WebM bytes (or the reverse) is exactly the kind of file a
 * desktop player refuses to open. Known video extensions that do not match the
 * real container are replaced; anything else only gets the extension appended.
 */
function withVideoExtension(path: string, ext: "mp4" | "webm"): string {
    const trimmed = path.trim().replace(/[\\/]+$/, "");
    if (!trimmed) return `creator-screen.${ext}`;

    const separator = Math.max(
        trimmed.lastIndexOf("/"),
        trimmed.lastIndexOf("\\"),
    );
    const name = separator >= 0 ? trimmed.slice(separator + 1) : trimmed;
    const dot = name.lastIndexOf(".");
    const current = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";

    if (current === ext) return trimmed;
    if (KNOWN_VIDEO_EXTENSIONS.includes(current)) {
        return `${trimmed.slice(0, trimmed.length - current.length - 1)}.${ext}`;
    }
    return `${trimmed}.${ext}`;
}

function detectPlatform(): NodeJS.Platform {
    if (typeof navigator === "undefined") return "linux";
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "win32";
    if (ua.includes("mac")) return "darwin";
    return "linux";
}

type SaveTarget =
    | { kind: "target"; target: string; ext: "mp4" | "webm" }
    | { kind: "canceled" }
    | { kind: "error"; error: string };

/**
 * Ask the user where the recording should go.
 *
 * A dialog that never opened is a failure, not a cancel — say so instead of
 * silently doing nothing.
 */
async function chooseSaveTarget(fileName: string): Promise<SaveTarget> {
    const ext = containerExtension(fileName);
    try {
        const chosen = await save({
            defaultPath: fileName,
            filters: [{ name: "Video", extensions: [ext] }],
        });
        if (chosen === null) return { kind: "canceled" };
        return { kind: "target", target: withVideoExtension(chosen, ext), ext };
    } catch (err) {
        console.warn("plugin-dialog save error:", err);
        return {
            kind: "error",
            error: `Dialog simpan tidak bisa dibuka: ${errorMessage(err)}`,
        };
    }
}

function installBridge() {
    if (!isTauri()) return;
    if (window.creatorScreen) return; // already installed

    const bridge: CreatorScreenBridge = {
        isDesktop: true,
        isElectron: true, // alias for backwards compatibility
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

            void listen<CaptureSource[]>(
                "picker:request",
                (event) => {
                    const payload = (event.payload ?? []).map((s) => ({
                        id: s.id,
                        name: s.name,
                        kind: (s.kind === "window" ? "window" : "screen") as
                            | "screen"
                            | "window",
                        thumbnail: s.thumbnail ?? null,
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

        saveRecording: async (
            data: Uint8Array | Blob,
            fileName: string,
        ): Promise<SaveRecordingResult> => {
            const total = data instanceof Blob ? data.size : data.length;

            if (total === 0) {
                return {
                    saved: false,
                    canceled: false,
                    error: "Rekaman kosong (0 byte).",
                };
            }

            const chosen = await chooseSaveTarget(fileName);
            if (chosen.kind === "canceled") return { saved: false, canceled: true };
            if (chosen.kind === "error") {
                return { saved: false, canceled: false, error: chosen.error };
            }
            const target = chosen.target;

            try {
                await invoke("save_recording_begin", { path: target });
            } catch (err) {
                return {
                    saved: false,
                    canceled: false,
                    error: errorMessage(err),
                };
            }

            try {
                for (let offset = 0; offset < total; offset += WRITE_CHUNK_BYTES) {
                    const end = Math.min(offset + WRITE_CHUNK_BYTES, total);
                    // `save_recording_write` reads the whole request body, so a
                    // Uint8Array view crosses the IPC boundary as raw bytes
                    // instead of a JSON array of numbers.
                    const chunk =
                        data instanceof Blob
                            ? new Uint8Array(
                                  await data.slice(offset, end).arrayBuffer(),
                              )
                            : data.subarray(offset, end);
                    await invoke<number>("save_recording_write", chunk);
                }

                const result = await invoke<SaveRecordingResult>(
                    "save_recording_finish",
                );
                return { ...result, path: result.path ?? target };
            } catch (err) {
                // Never leave a half-written file behind.
                await invoke("save_recording_abort").catch(() => {});
                return {
                    saved: false,
                    canceled: false,
                    error: errorMessage(err),
                };
            }
        },

        // The recording already lives on disk when this is called; the backend
        // only copies it to wherever the user picks.
        saveRecordingFile: async (
            sourcePath: string,
            fileName: string,
        ): Promise<SaveRecordingResult> => {
            const chosen = await chooseSaveTarget(fileName);
            if (chosen.kind === "canceled") return { saved: false, canceled: true };
            if (chosen.kind === "error") {
                return { saved: false, canceled: false, error: chosen.error };
            }

            try {
                return await invoke<SaveRecordingResult>("save_recording_file", {
                    source: sourcePath,
                    target: chosen.target,
                });
            } catch (err) {
                return {
                    saved: false,
                    canceled: false,
                    error: errorMessage(err),
                };
            }
        },

        startScreenRecording: async (
            withMic: boolean,
            micLabel?: string | null,
        ): Promise<StartRecordingResult> => {
            try {
                return await invoke<StartRecordingResult>(
                    "start_screen_recording",
                    { withMic, micDevice: micLabel ?? null },
                );
            } catch (err) {
                return { ok: false, error: errorMessage(err) };
            }
        },

        stopScreenRecording: async (): Promise<RecordedScreenFile> => {
            try {
                return await invoke<RecordedScreenFile>(
                    "stop_screen_recording",
                );
            } catch (err) {
                return {
                    path: "",
                    bytes: 0,
                    error: errorMessage(err),
                };
            }
        },

        onScreenRecordingEnded: (cb) => {
            let unlisten: (() => void) | null = null;
            void listen("screen-recording:ended", () => cb()).then((un) => {
                unlisten = un;
            });
            return () => {
                if (unlisten) unlisten();
            };
        },
    };

    window.creatorScreen = bridge;

    // Asynchronously refine with the exact platform reported by backend
    void invoke<string>("get_platform").then((p) => {
        bridge.platform = p as NodeJS.Platform;
    });
}

// Install immediately (side-effect import). Non-Tauri environments (pure web)
// are skipped.
installBridge();

export {};
