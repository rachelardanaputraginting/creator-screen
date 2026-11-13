import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Scene } from "../types/scene";
import type { Overlay } from "../types/overlay";
import type { Source } from "../types/source";

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
  background: string;
  setBackground: (type: string) => void;

  // Marquee tech stack (null = daftar bawaan)
  marqueeItems: string[] | null;
  setMarqueeItems: (items: string[] | null) => void;
  marqueeDurationSec: number;
  setMarqueeDurationSec: (seconds: number) => void;

  // Screen display fit ("contain" = rasio asli, "cover" = penuhi layar tanpa batas hitam)
  screenFit: "contain" | "cover";
  setScreenFit: (fit: "contain" | "cover") => void;

  // Sidebar visibility
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Audio processing
  noiseSuppression: boolean;
  setNoiseSuppression: (val: boolean) => void;
  echoCancellation: boolean;
  setEchoCancellation: (val: boolean) => void;
  autoGainControl: boolean;
  setAutoGainControl: (val: boolean) => void;
  voiceEnhancer: boolean;
  setVoiceEnhancer: (val: boolean) => void;
}

export const useStore = create<CanvasState>()(
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
      addScene: (scene) =>
        set((state) =>
          state.scenes.some((s) => s.id === scene.id)
            ? state
            : { scenes: [...state.scenes, scene] }
        ),
      updateScene: (id, updates) =>
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),
      removeScene: (id) => set((state) => ({ scenes: state.scenes.filter((s) => s.id !== id) })),
      renameScene: (id, name) =>
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === id ? { ...s, name } : s)),
        })),
      switchScene: (id) =>
        set((state) => {
          const scene = state.scenes.find((s) => s.id === id);
          if (!scene) return state;
          return {
            currentScene: scene,
            source: scene.source,
            overlays: scene.overlays,
            background: scene.background,
            canvasWidth: scene.canvasWidth,
            canvasHeight: scene.canvasHeight,
            selectedOverlayId: null,
          };
        }),

      // Fullscreen
      isFullscreen: false,
      setIsFullscreen: (value) => set({ isFullscreen: value }),

      // Session
      isSessionActive: false,
      setIsSessionActive: (value) => set({ isSessionActive: value }),

      // Background
      background: "solid",
      setBackground: (type) => set({ background: type }),

      // Marquee
      marqueeItems: null,
      setMarqueeItems: (items) => set({ marqueeItems: items }),
      marqueeDurationSec: 30,
      setMarqueeDurationSec: (seconds) =>
        set({ marqueeDurationSec: Math.min(120, Math.max(8, seconds || 30)) }),

      // Screen fit
      screenFit: "contain",
      setScreenFit: (fit) => set({ screenFit: fit }),

      // Sidebar visibility
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Audio processing
      noiseSuppression: true,
      setNoiseSuppression: (val) => set({ noiseSuppression: val }),
      echoCancellation: true,
      setEchoCancellation: (val) => set({ echoCancellation: val }),
      autoGainControl: true,
      setAutoGainControl: (val) => set({ autoGainControl: val }),
      voiceEnhancer: true,
      setVoiceEnhancer: (val) => set({ voiceEnhancer: val }),
    }),
    {
      name: "creator-screen-storage",
      storage: createJSONStorage(() => localStorage),
      // Session & fullscreen adalah state runtime — jangan dipersist.
      // Kalau ikut tersimpan, tab yang ditutup saat session aktif akan
      // "bangun" dalam mode presentation (header hilang, edit About
      // disembunyikan) pada load berikutnya.
      partialize: (state) => ({
        source: state.source,
        canvasWidth: state.canvasWidth,
        canvasHeight: state.canvasHeight,
        overlays: state.overlays,
        selectedOverlayId: state.selectedOverlayId,
        currentScene: state.currentScene,
        scenes: state.scenes,
        background: state.background,
        marqueeItems: state.marqueeItems,
        marqueeDurationSec: state.marqueeDurationSec,
        screenFit: state.screenFit,
        sidebarCollapsed: state.sidebarCollapsed,
        noiseSuppression: state.noiseSuppression,
        echoCancellation: state.echoCancellation,
        autoGainControl: state.autoGainControl,
        voiceEnhancer: state.voiceEnhancer,
      }),
    }
  )
);