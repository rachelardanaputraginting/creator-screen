export type CapturePurpose = "record" | "preview";

export interface CaptureSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string | null;
}

export interface CreatorScreenBridge {
  isElectron: boolean;
  setCapturePurpose: (purpose: CapturePurpose) => void;
  onPickerRequest: (cb: (sources: CaptureSource[]) => void) => () => void;
  selectSource: (id: string) => void;
}

declare global {
  interface Window {
    creatorScreen?: CreatorScreenBridge;
  }
}
