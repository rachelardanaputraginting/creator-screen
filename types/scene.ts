export type OverlayType = "camera" | "text" | "image" | "timer" | "keystroke";

export type Shape = "rectangle" | "rounded-rectangle" | "circle";

export enum BackgroundType {
  Transparent = "transparent",
  Solid = "solid",
  Gradient = "gradient",
  Image = "image",
}

export interface Overlay {
  id: string;
  type: OverlayType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  visible: boolean;
  locked?: boolean;
  zIndex: number;
  shape?: Shape;
  mirror?: boolean;
}

export interface Source {
  id: string;
  type: "screen" | "window" | "camera" | "image" | "color";
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

export type SourceType = ScreenSource | WindowSource | CameraSource | ImageSource | ColorSource;

/** Profil perangkat sebuah scene — kamera/mic/mirror yang langsung
 *  di-apply saat berpindah scene. */
export interface SceneDevices {
  cameraOn: boolean;
  micOn: boolean;
  micDeviceId: string;
  mirror: boolean;
}

export interface Scene {
  id: string;
  name: string;
  source: Source;
  overlays: Overlay[];
  background: BackgroundType;
  canvasWidth: number;
  canvasHeight: number;
  devices?: SceneDevices;
}

export type SceneId = string;