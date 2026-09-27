# PRD — Creator Screen

## 1. Product Overview

### Product Name

**Creator Screen**

### Product Type

Desktop application for creating a clean visual layout for content creation.

### One-Line Description

> Creator Screen is a lightweight desktop visual compositor that displays a main content source in fullscreen while allowing floating overlays such as camera, text, timer, images, and branding elements.

### Core Concept

The application is **NOT a video recorder**.

The application is responsible for:

* displaying content;
* capturing/previewing screen or application windows;
* displaying a floating camera preview when available;
* composing visual overlays;
* switching between predefined scenes;
* providing a clean fullscreen presentation.

The user may use a **separate physical smartphone** to record the real-world setup.

Example physical setup:

```text
                     👤 CREATOR
                        │
                        │
                ┌───────┴────────┐
                │                │
                │     LAPTOP     │
                │                │
                └────────────────┘
                        ▲
                        │
                       📱
                  smartphone
                   recording
```

---

# 2. Problem Statement

Content creators who record coding, tutorials, development sessions, or educational content often need a visually clean composition.

Typical setup:

* laptop showing code;
* creator sitting beside the laptop;
* smartphone recording the physical scene;
* small creator/camera overlay;
* additional information such as timer, title, logo, or keyboard shortcuts.

The problem is that normal desktop applications are often designed around recording or streaming rather than simply creating a clean display composition.

Creator Screen focuses specifically on the **visual composition layer**.

---

# 3. Product Goals

## Primary Goals

1. Display a large main content area.
2. Allow floating visual elements.
3. Allow the camera preview to behave like a draggable floating object.
4. Support screen capture.
5. Support application/window capture where technically available.
6. Support camera preview where technically available.
7. Provide scenes/presets.
8. Allow fullscreen presentation.
9. Keep the UI simple and creator-friendly.
10. Use **shadcn/ui** as the primary UI component system.

## Secondary Goals

* keyboard shortcuts;
* persistent layouts;
* timer;
* keystroke display;
* mouse/click effects;
* branding overlays;
* customizable backgrounds;
* reusable scenes.

---

# 4. Non-Goals

The first version MUST NOT focus on:

* video recording;
* audio recording;
* video editing;
* uploading videos;
* cloud storage;
* livestreaming;
* RTMP streaming;
* social media publishing;
* user accounts;
* multiplayer collaboration.

The application should NOT automatically record the user's screen.

---

# 5. Target Users

Primary:

* programmers;
* coding content creators;
* tutorial creators;
* students;
* developers making build-in-public content;
* educators.

Example user:

> A developer wants to record a coding session using a smartphone placed beside the laptop. The laptop should show the coding content prominently with a small floating creator/camera window.

---

# 6. Core User Experience

The user launches Creator Screen.

They see a dashboard:

```text
┌─────────────────────────────────────────────────────┐
│ Creator Screen                              Settings │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│ Scenes       │                                      │
│              │              Canvas                  │
│ Coding       │                                      │
│ Browser      │         MAIN CONTENT                 │
│ Terminal     │                                      │
│ Presentation │                         ┌──────────┐ │
│              │                         │ Camera   │ │
│              │                         │    👤    │ │
│              │                         └──────────┘ │
│              │                                      │
├──────────────┴──────────────────────────────────────┤
│ Source: Screen 1       [Fullscreen] [Start Session] │
└─────────────────────────────────────────────────────┘
```

The user can then:

1. choose a source;
2. add overlays;
3. drag overlays;
4. resize overlays;
5. save the scene;
6. enter fullscreen;
7. start their external smartphone recording.

---

# 7. Main Layout

The application has two primary modes.

## 7.1 Editor Mode

Used to configure the composition.

```text
┌────────────────────────────────────────────────────────────┐
│ Header                                                     │
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│ Sidebar      │                 Canvas                      │
│              │                                             │
│ Sources      │             Main Content                    │
│ Overlays     │                                             │
│ Scenes       │                              ┌───────────┐  │
│              │                              │  Camera   │  │
│              │                              └───────────┘  │
│              │                                             │
├──────────────┴─────────────────────────────────────────────┤
│ Status Bar                                                 │
└────────────────────────────────────────────────────────────┘
```

## 7.2 Presentation / Fullscreen Mode

Only the composition should be visible.

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                                                            │
│                     MAIN CONTENT                           │
│                                                            │
│                                                            │
│                                             ┌──────────┐   │
│                                             │    👤    │   │
│                                             │  CAMERA  │   │
│                                             └──────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

The editor UI must disappear.

---

# 8. Technology Stack

Use the following stack unless a technical limitation requires a documented alternative.

## Frontend

* React
* TypeScript
* Tailwind CSS
* **shadcn/ui**
* Lucide React icons

## Desktop Runtime

Preferred:

* Tauri

Alternative only if required:

* Electron

The application should prioritize a lightweight desktop runtime.

## State Management

Prefer:

* React state/context for simple state;
* Zustand if global state becomes necessary.

Do NOT introduce Redux unless there is a strong architectural reason.

## Persistence

For MVP:

* local JSON/config persistence;
* or SQLite if desktop-native persistence is needed.

No cloud backend is required.

---

# 9. UI Requirements

## Design System

The UI MUST use **shadcn/ui**.

Do not create custom versions of components that already exist in shadcn/ui.

Use shadcn/ui components such as:

* Button
* Dialog
* Dropdown Menu
* Context Menu
* Tooltip
* Popover
* Select
* Slider
* Switch
* Tabs
* Card
* Input
* Label
* Separator
* Scroll Area
* Sheet
* Command
* Alert Dialog
* Toast/Sonner
* Resizable panels where appropriate.

Use Lucide icons.

---

# 10. Visual Design

Design direction:

* modern;
* minimal;
* professional;
* developer-oriented;
* dark-first;
* low visual noise;
* rounded corners;
* subtle borders;
* restrained shadows.

Do NOT make it look like a generic admin dashboard.

The canvas should be the visual focus.

---

# 11. Color System

Use the shadcn theme system.

Primary:

* neutral/dark UI.

Canvas:

* dark background by default.

Accent:

* configurable through theme variables.

Avoid excessive colors.

The application should look good in a dark room because the user may record the laptop with a smartphone.

---

# 12. Application Structure

Suggested structure:

```text
src/
├── components/
│   ├── ui/
│   ├── canvas/
│   ├── overlays/
│   ├── sources/
│   ├── scenes/
│   ├── editor/
│   └── settings/
│
├── features/
│   ├── canvas/
│   ├── sources/
│   ├── overlays/
│   ├── scenes/
│   ├── fullscreen/
│   └── shortcuts/
│
├── stores/
│   ├── canvas-store.ts
│   ├── scene-store.ts
│   └── settings-store.ts
│
├── types/
│   ├── scene.ts
│   ├── overlay.ts
│   └── source.ts
│
├── lib/
│   ├── utils.ts
│   └── persistence.ts
│
└── app/
```

Adapt this structure to the chosen framework/runtime.

---

# 13. Source System

A source represents the content displayed on the canvas.

Supported source types:

```text
Screen
Window
Camera
Image
Color
```

## 13.1 Screen Source

The user can select a display/monitor.

Example:

```text
Screen Sources

○ Display 1 — 1920 × 1080
○ Display 2 — 2560 × 1440
```

The application displays the selected screen inside the canvas.

Important:

**Screen capture is for display/preview only.**

It must not automatically save a recording.

---

# 14. Window Source

If supported by the platform/runtime, allow the user to select a specific application window.

Example:

```text
Window Sources

VS Code
Google Chrome
Terminal
Figma
Discord
```

The selected window becomes the main content source.

If native window capture is not supported reliably on the target platform, provide a clear fallback to screen capture.

---

# 15. Camera Source

Camera is an optional source.

The user can select:

```text
Camera

No Camera

Integrated Camera

USB Camera
```

When active, the camera appears as a floating overlay.

The application must request camera permission appropriately.

Camera preview is NOT automatically recorded.

---

# 16. Overlay System

Every overlay should be an independent object.

Example data model:

```ts
type Overlay = {
  id: string
  type: "camera" | "text" | "image" | "timer" | "keystroke"
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity?: number
  visible: boolean
  locked?: boolean
  zIndex: number
}
```

---

# 17. Floating Overlay Interaction

Overlays must support:

* drag;
* resize;
* select;
* delete;
* duplicate;
* hide/show;
* lock/unlock;
* bring to front;
* send to back.

Selected overlays should display a subtle bounding box.

Example:

```text
┌───────────────────────────────────────────┐
│                                           │
│                  CONTENT                  │
│                                           │
│                           ┌───────────┐   │
│                           │           │   │
│                           │    👤     │   │
│                           │           │   │
│                           └───────────┘   │
│                             ↑ selected    │
└───────────────────────────────────────────┘
```

---

# 18. Camera Overlay

Camera overlay should support:

### Position

* top-left;
* top-right;
* bottom-left;
* bottom-right;
* custom.

### Shape

* rectangle;
* rounded rectangle;
* circle.

### Appearance

* border;
* border radius;
* shadow;
* opacity;
* mirror;
* aspect ratio.

### Size

Allow free resizing with minimum dimensions.

---

# 19. Text Overlay

Users can add text.

Example:

```text
Rachel Ginting
Full Stack Developer
```

Controls:

* text;
* font size;
* font weight;
* alignment;
* opacity;
* position;
* background;
* padding;
* border radius.

Use sensible defaults.

---

# 20. Image Overlay

Allow local image selection.

Examples:

* logo;
* watermark;
* project logo;
* social media icon.

Controls:

* size;
* position;
* opacity;
* border radius;
* rotation.

---

# 21. Timer Overlay

Provide a simple timer.

Modes:

```text
00:00:00
```

Options:

* stopwatch;
* countdown.

Controls:

* start;
* pause;
* reset;
* font size;
* position.

Timer state should be scene-specific if appropriate.

---

# 22. Keystroke Overlay

Optional advanced feature.

Display recent keyboard shortcuts.

Example:

```text
┌─────────────────────┐
│     Ctrl + K        │
│     Ctrl + C        │
└─────────────────────┘
```

The overlay should not capture passwords or sensitive text.

For MVP, support common keyboard shortcuts rather than attempting to display every typed character.

---

# 23. Scene System

A scene is a saved composition.

Example:

```text
Scenes

Coding
Browser
Terminal
Presentation
Break
```

Each scene stores:

* main source;
* overlays;
* overlay positions;
* sizes;
* visibility;
* canvas background;
* settings.

Example:

```ts
type Scene = {
  id: string
  name: string
  source: Source
  overlays: Overlay[]
  background: Background
}
```

---

# 24. Default Scenes

On first launch create:

### Coding

Main:

* Screen/Window source

Overlay:

* camera top-right

### Browser

Main:

* browser/window source

Overlay:

* small camera

### Terminal

Main:

* terminal/window source

Overlay:

* timer

### Presentation

Main:

* screen source

Overlay:

* logo

---

# 25. Scene Switching

Scene switching should be fast.

Users should be able to switch from:

```text
Coding
↓
Browser
↓
Terminal
```

without rebuilding the layout.

Keyboard shortcuts:

```text
Ctrl + 1 → Coding
Ctrl + 2 → Browser
Ctrl + 3 → Terminal
Ctrl + 4 → Presentation
```

Allow customization later.

---

# 26. Fullscreen Mode

Button:

```text
[ Enter Fullscreen ]
```

Shortcut:

```text
Ctrl + Shift + F
```

Fullscreen mode:

* hides editor UI;
* displays canvas only;
* preserves overlay positions;
* keeps source active;
* prevents accidental editing.

Escape exits fullscreen.

---

# 27. Session Mode

Add:

```text
[ Start Session ]
```

This does NOT start recording.

It only changes the application state.

Example:

```text
● SESSION ACTIVE
```

Possible behavior:

* hide editor UI;
* activate fullscreen;
* start timer if configured;
* lock overlays;
* prevent accidental changes.

Button:

```text
[ End Session ]
```

Again:

**No video file is generated.**

---

# 28. Canvas

Canvas should maintain a predictable aspect ratio.

Default:

```text
16:9
```

Example:

```text
1920 × 1080
```

Support:

* 16:9;
* 16:10;
* 4:3;
* custom.

The canvas should scale responsively while preserving aspect ratio.

---

# 29. Canvas Background

Options:

```text
Background

○ Transparent
○ Solid
○ Gradient
○ Image
```

For MVP:

* solid background;
* configurable color.

---

# 30. Layer Management

Provide a layer panel.

Example:

```text
LAYERS

☰ Camera
☰ Timer
☰ Name
☰ Main Content
```

Users can:

* reorder;
* hide;
* lock;
* delete.

Use drag-and-drop if practical.

---

# 31. Properties Panel

When an overlay is selected:

```text
┌──────────────────────────┐
│ Camera                   │
├──────────────────────────┤
│ Position                 │
│ X       [ 145 ]          │
│ Y       [ 80  ]          │
│                          │
│ Size                     │
│ W       [ 320 ]          │
│ H       [ 180 ]          │
│                          │
│ Opacity                  │
│ ─────────●──────         │
│                          │
│ Shape                    │
│ [ Rounded Rectangle ▼ ]  │
│                          │
│ [ ] Mirror               │
│ [ ] Lock                 │
└──────────────────────────┘
```

---

# 32. Keyboard Shortcuts

Initial shortcuts:

```text
Ctrl + Shift + F
→ Fullscreen

Ctrl + 1
→ Scene 1

Ctrl + 2
→ Scene 2

Ctrl + 3
→ Scene 3

Ctrl + S
→ Save scene

Ctrl + Z
→ Undo

Ctrl + Shift + Z
→ Redo

Delete
→ Delete selected overlay

Escape
→ Exit fullscreen / deselect
```

---

# 33. Undo / Redo

Editor operations should support undo/redo.

At minimum:

* move overlay;
* resize overlay;
* delete;
* add;
* reorder;
* change properties.

---

# 34. Persistence

Scenes should persist locally.

After restarting the application:

* scenes remain;
* settings remain;
* last selected scene can optionally be restored.

No account is required.

---

# 35. Settings

Settings page/dialog:

```text
Settings

Appearance
├── Theme
├── Canvas
└── UI Scale

Camera
├── Default Camera
├── Mirror
└── Default Position

Shortcuts
├── Fullscreen
├── Session
└── Scene switching

General
├── Start with last scene
└── Confirm before exit
```

---

# 36. Onboarding

First launch should show a lightweight onboarding dialog:

```text
Welcome to Creator Screen

Create beautiful layouts for coding,
tutorials, and content creation.

[ Get Started ]
```

Then explain:

```text
1. Choose your content
2. Add floating overlays
3. Enter fullscreen
4. Record the physical setup with your phone
```

Make it clear that the app itself does not record video.

---

# 37. Empty States

If no source is selected:

```text
No content source

Choose a screen or window to begin.

[ Add Source ]
```

If no camera:

```text
No camera selected

You can continue without a camera.

[ Add Camera ]
```

---

# 38. Error Handling

Errors must be user-friendly.

Bad:

```text
Error: getDisplayMedia failed
```

Better:

```text
Unable to access this screen.

Check your system permissions and try again.
```

Provide:

```text
[ Try Again ]
```

---

# 39. Permission Handling

For screen capture:

* request permission only when required.

For camera:

* request camera permission only when user adds a camera.

Do not request unnecessary permissions during startup.

---

# 40. Performance Requirements

The application should feel lightweight.

Requirements:

* smooth dragging;
* smooth resizing;
* minimal UI latency;
* avoid unnecessary re-renders;
* clean up media streams when removed;
* stop camera tracks when camera overlay is disabled;
* avoid memory leaks;
* avoid continuously processing frames when not needed.

---

# 41. Responsive Behavior

The editor should work at common desktop resolutions.

Minimum target:

```text
1280 × 720
```

Preferred:

```text
1920 × 1080
```

The canvas should adapt without breaking the sidebar/property panel.

---

# 42. Accessibility

Use:

* keyboard navigation;
* visible focus states;
* accessible labels;
* tooltips;
* proper button semantics.

All icon-only buttons must have accessible labels.

---

# 43. Security / Privacy

Important:

The application should prioritize local processing.

Do not:

* upload screen content;
* upload camera feed;
* upload screenshots;
* collect recording data.

Camera and screen streams should remain local.

---

# 44. MVP Scope

The first implementation should contain ONLY:

### Core

* desktop application;
* dark UI;
* shadcn/ui;
* canvas;
* screen source;
* camera source;
* floating camera;
* drag;
* resize;
* delete;
* hide/show;
* lock;
* scene system;
* fullscreen;
* local persistence.

### MVP UI

```text
Dashboard
├── Sidebar
│   ├── Sources
│   ├── Overlays
│   └── Scenes
│
├── Canvas
│
├── Properties
│
└── Bottom Status Bar
```

Do NOT over-engineer MVP.

---

# 45. Phase 2

After MVP works:

* window capture;
* text overlay;
* image overlay;
* timer;
* layer manager;
* keyboard shortcuts;
* undo/redo;
* scene duplication;
* custom canvas ratios.

---

# 46. Phase 3

Advanced features:

* keystroke display;
* mouse highlight;
* click animations;
* animated overlays;
* transition between scenes;
* hotkeys;
* custom templates;
* multi-monitor workflow;
* automatic scene switching;
* presentation mode.

---

# 47. Phase 4

Optional future features:

* plugin system;
* community templates;
* cloud sync;
* export/import scenes;
* OBS integration;
* streaming integrations.

These are NOT part of the MVP.

---

# 48. Important Architecture Rule

Separate these concepts:

```text
SOURCE
   ↓
COMPOSITION
   ↓
DISPLAY
```

Do NOT implement:

```text
SOURCE
   ↓
RECORDING
```

The application is a **visual compositor/display application**, not a recorder.

---

# 49. Example User Flow

## Coding Content

### Step 1

Open Creator Screen.

### Step 2

Select:

```text
Scene → Coding
```

### Step 3

Select:

```text
Source → Screen 1
```

### Step 4

Add camera.

Camera appears:

```text
                         ┌───────────┐
                         │    👤     │
                         └───────────┘
```

### Step 5

Drag camera to top-right.

### Step 6

Resize camera to approximately 15% of canvas width.

### Step 7

Press:

```text
Ctrl + Shift + F
```

### Step 8

Laptop displays:

```text
┌────────────────────────────────────────────────────┐
│                                                    │
│                  CODING CONTENT                    │
│                                                    │
│                                                    │
│                                      ┌──────────┐  │
│                                      │    👤    │  │
│                                      └──────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Step 9

User places smartphone beside laptop.

The smartphone records the physical environment.

### Step 10

Creator begins coding.

Creator Screen itself does not record anything.

---

# 50. UX Principle

The user should always understand:

> "What I see on this laptop is the final composition I want my external camera to capture."

This is the fundamental product concept.

---

# 51. Acceptance Criteria — MVP

The MVP is considered successful when:

### Canvas

* [ ] Main canvas renders correctly.
* [ ] Canvas supports 16:9.
* [ ] Canvas scales without distortion.

### Screen Source

* [ ] User can select a screen.
* [ ] Selected screen appears in the canvas.
* [ ] Screen preview updates correctly.
* [ ] Removing source stops the stream.

### Camera

* [ ] User can select a camera.
* [ ] Camera preview appears.
* [ ] Camera is a floating overlay.
* [ ] Camera can be dragged.
* [ ] Camera can be resized.
* [ ] Camera can be hidden.
* [ ] Camera can be locked.
* [ ] Camera stream is stopped when removed.

### Scenes

* [ ] User can create scene.
* [ ] User can rename scene.
* [ ] User can switch scenes.
* [ ] Scene stores source.
* [ ] Scene stores overlay positions.
* [ ] Scene persists after restart.

### Fullscreen

* [ ] Fullscreen hides editor UI.
* [ ] Canvas fills the available screen.
* [ ] Escape exits fullscreen.

### Session

* [ ] Start Session enters presentation state.
* [ ] Session does not create a video file.
* [ ] End Session returns to editor.

### UI

* [ ] shadcn/ui is used throughout the application UI.
* [ ] Lucide icons are used.
* [ ] Dark theme works.
* [ ] Keyboard navigation works.
* [ ] No unnecessary custom UI component library is introduced.

---

# 52. Development Rules for OpenCode

When implementing this project:

1. Read this PRD completely before coding.
2. Do not immediately create every advanced feature.
3. Implement MVP first.
4. Keep architecture modular.
5. Use TypeScript strictly.
6. Use shadcn/ui.
7. Use Tailwind CSS.
8. Use Lucide icons.
9. Avoid unnecessary dependencies.
10. Avoid Redux unless absolutely necessary.
11. Do not introduce a backend unless required.
12. Keep all user data local.
13. Do not implement recording.
14. Do not upload screen/camera data.
15. Do not replace shadcn/ui with another UI library.
16. Use reusable components.
17. Keep source, overlay, scene, and canvas logic separated.
18. Add clear loading/error/empty states.
19. Handle cleanup of media streams properly.
20. Prioritize Windows desktop support.

---

# 53. Suggested Implementation Order

OpenCode should implement in this order:

## Phase 1 — Foundation

1. Initialize project.
2. Configure TypeScript.
3. Configure Tailwind.
4. Install/configure shadcn/ui.
5. Configure Lucide icons.
6. Create application shell.
7. Create dark theme.

## Phase 2 — Canvas

1. Create canvas.
2. Create canvas scaling.
3. Create editor layout.
4. Create sidebar.
5. Create properties panel.

## Phase 3 — Sources

1. Implement screen source.
2. Implement source selector.
3. Implement media stream lifecycle.
4. Implement camera source.

## Phase 4 — Floating Overlay

1. Overlay model.
2. Dragging.
3. Resizing.
4. Selection.
5. Lock.
6. Visibility.
7. Delete.

## Phase 5 — Scenes

1. Scene model.
2. Scene creation.
3. Scene switching.
4. Scene persistence.
5. Default scenes.

## Phase 6 — Fullscreen

1. Fullscreen.
2. Presentation mode.
3. Session mode.

## Phase 7 — Polish

1. Keyboard shortcuts.
2. Loading states.
3. Error states.
4. Empty states.
5. Accessibility.
6. Performance optimization.

Only after these work should advanced features be implemented.

---

# 54. Definition of Done

The MVP is complete when a user can:

```text
Open application
      ↓
Choose screen
      ↓
See content on canvas
      ↓
Add camera
      ↓
Camera becomes floating
      ↓
Drag + resize camera
      ↓
Save scene
      ↓
Enter fullscreen
      ↓
Place smartphone beside laptop
      ↓
Record physical setup externally
      ↓
Code / create content
```

without needing:

* OBS;
* a recording feature inside Creator Screen;
* a phone connection;
* cloud services;
* an account.

---

# 55. Final Product Vision

Creator Screen should feel like:

> **"A clean digital stage for my physical content-creation setup."**

The laptop is the stage.

The main content is the focus.

The camera/creator window is a small floating element.

The smartphone is the actual external camera.

The application does the composition, not the recording.

The most important visual principle is:

```text
                    MAIN CONTENT
              ┌─────────────────────────┐
              │                         │
              │                         │
              │                         │
              │                         │
              │                         │
              │                    👤   │
              │                  FLOAT  │
              │                         │
              └─────────────────────────┘
```

The content must always remain dominant.

The creator overlay must remain secondary.

The interface must remain minimal.

And the entire application must be built with **shadcn/ui + Tailwind CSS + TypeScript**, with a lightweight desktop runtime and local-first architecture.
