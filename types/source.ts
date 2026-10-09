export type SourceType = "screen" | "window" | "camera" | "image" | "color";

export interface Source {
  id: string;
  type: SourceType;
  label: string;
  active: boolean;
}

export interface ScreenSource extends Source {
  type: "screen";
  displayName: string;
  resolution: string;
}

export interface WindowSource extends Source {
  type: "window";
  appName: string;
  title: string;
}

export interface CameraSource extends Source {
  type: "camera";
  facingMode: "user" | "environment";
}

export interface ImageSource extends Source {
  type: "image";
  src: string;
  alt: string;
}

export interface ColorSource extends Source {
  type: "color";
  color: string;
}