export type CapturePurpose = "record" | "preview";

export interface CaptureSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string | null;
}

export interface SaveRecordingResult {
  saved: boolean;
  path?: string;
  canceled?: boolean;
  /** Size of the file that landed on disk. */
  bytes?: number;
  /** Set when the save failed; the renderer shows this to the user. */
  error?: string;
}

/** A recording the native backend finished, still sitting in the app cache. */
export interface RecordedScreenFile {
  path: string;
  bytes: number;
  canceled?: boolean;
  error?: string;
}

export interface StartRecordingResult {
  ok: boolean;
  /** The user dismissed the portal dialog — not an error. */
  canceled?: boolean;
  error?: string;
}

export interface CreatorScreenBridge {
  isDesktop?: boolean;
  isElectron?: boolean; // kept as alias for backwards compatibility
  platform: NodeJS.Platform;
  setCapturePurpose: (purpose: CapturePurpose) => void;
  onPickerRequest: (cb: (sources: CaptureSource[]) => void) => () => void;
  selectSource: (id: string) => void;
  saveRecording: (
    data: Uint8Array | Blob,
    fileName: string,
  ) => Promise<SaveRecordingResult>;
  /**
   * Native recording (Linux). WebKitGTK's display-capture frames cannot be
   * encoded by the renderer here, so the backend records through the
   * xdg-desktop-portal ScreenCast + GStreamer instead.
   */
  startScreenRecording?: (
    withMic: boolean,
    micLabel?: string | null,
  ) => Promise<StartRecordingResult>;
  stopScreenRecording?: () => Promise<RecordedScreenFile>;
  /** Copy a finished recording to the destination the user picks. */
  saveRecordingFile?: (
    sourcePath: string,
    fileName: string,
  ) => Promise<SaveRecordingResult>;
  /** Fires when the shared window/screencast ends before the user stops it. */
  onScreenRecordingEnded?: (cb: () => void) => () => void;
}

declare global {
  interface Window {
    creatorScreen?: CreatorScreenBridge;
  }
}
