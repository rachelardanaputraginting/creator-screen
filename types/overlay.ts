export type OverlayType = "camera" | "text" | "image" | "timer" | "keystroke";

export type Shape = "rectangle" | "rounded-rectangle" | "circle";

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