import create from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Scene, Overlay, Source, SourceType } from "../types";

export type OverlayType = Overlay["type"];

export interface CanvasState {
  // Source
  source: Source | null;
  setSource: (source: Source | null) => void;

  // Canvas dimensions
  canvasWidth: number;
  canvasHeight: number;
  setCanvasDimensions: (width: number, height: number) => void;

  // Overlays
  overlays: Overlay[];
  setOverlays: (overlays: Overlay[]) => void;
  addOverlay: (overlay: Overlay) => void;
  updateOverlay: (id: string, updates: Partial<Overlay>) => void;
  removeOverlay: (id: string) => void;
  clearOverlays: () => void;

  // Selected overlay
  selectedOverlayId: string | null;
  setSelectedOverlay: (id: string | null) => void;

  // Scene
  currentScene: Scene | null;
  setCurrentScene: (scene: Scene | null) => void;

  // Scenes list
  scenes: Scene[];
  setScenes: (scenes: Scene[]) => void;
  addScene: (scene: Scene) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  switchScene: (id: string) => void;

  // Fullscreen
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;

  // Session
  isSessionActive: boolean;
  setIsSessionActive: (value: boolean) => void;

  // Background
  background: BackgroundType;
  setBackground: (type: BackgroundType) => void;
}

export const useStore = create<
  CanvasState &
  PersistMiddleware<CanvasState>
>()(
  persist(
    (set) => ({
      // Source
      source: null,
      setSource: (source) => set({ source }),

      // Canvas dimensions
      canvasWidth: 1920,
      canvasHeight: 1080,
      setCanvasDimensions: (width, height) => set({ canvasWidth: width, canvasHeight: height }),

      // Overlays
      overlays: [],
      setOverlays: (overlays) => set({ overlays }),
      addOverlay: (overlay) =>
        set((state) => ({ overlays: [...state.overlays, overlay] })),
      updateOverlay: (id, updates) =>
        set((state) => ({
          overlays: state.overlays.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),
      removeOverlay: (id) =>
        set((state) => ({
          overlays: state.overlays.filter((o) => o.id !== id),
        })),
      clearOverlays: () => set({ overlays: [] }),

      // Selected overlay
      selectedOverlayId: null,
      setSelectedOverlay: (id) => set({ selectedOverlayId: id }),

      // Scene
      currentScene: null,
      setCurrentScene: (scene) => set({ currentScene: scene }),

      // Scenes list
      scenes: [],
      setScenes: (scenes) => set({ scenes }),
      addScene: (scene) => set((state) => ({ scenes: [...state.scenes, scene] })),
      updateScene: (id, updates) =>
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),
      removeScene: (id) => set((state) => ({ scenes: state.scenes.filter((s) => s.id !== id) })),
      renameScene: (id, name) =>
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === id ? { ...s, name } : s)),
        })),
      switchScene: (id) => set({ currentScene: state.scenes.find((s) => s.id === id) || null }),

      // Fullscreen
      isFullscreen: false,
      setIsFullscreen: (value) => set({ isFullscreen: value }),

      // Session
      isSessionActive: false,
      setIsSessionActive: (value) => set({ isSessionActive: value }),

      // Background
      background: BackgroundType.Solid,
      setBackground: (type) => set({ background: type }),
    }),
    {
      name: "creator-screen-storage",
      storage: createJSONStorage(localStorage),
    }
  )
);

type PersistMiddleware = any;