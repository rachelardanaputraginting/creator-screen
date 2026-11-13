use serde::Serialize;
use std::fs::File;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct SaveRecordingResult {
    pub saved: bool,
    pub path: Option<String>,
    pub canceled: Option<bool>,
    /// Size of the finished file, so the renderer can confirm real bytes landed.
    pub bytes: Option<u64>,
}

/// Outcome of asking the backend to start a native recording. The portal
/// dialog can be dismissed, which is not an error.
#[derive(Debug, Clone, Serialize)]
pub struct StartRecordingResult {
    pub ok: bool,
    pub canceled: bool,
}

/// One in-flight chunked recording save.
///
/// The renderer streams the recording through the raw IPC body, which carries
/// bytes only — so the destination is opened once here and every chunk appends
/// to it. Bytes go to a sibling `.part` file that is renamed into place on
/// finish, which means a cancelled or failed save can never leave a truncated
/// video under the name the user picked (and never clobbers an existing file
/// before the new one is complete).
#[derive(Debug)]
pub struct RecordingTarget {
    pub final_path: PathBuf,
    pub part_path: PathBuf,
    pub file: Option<File>,
}

#[derive(Debug, Default)]
pub struct RecordingSink {
    pub target: std::sync::Mutex<Option<RecordingTarget>>,
}

/// Backend capture state — mirrors the purpose concept from the Electron
/// `capture.js` controller. Purpose "record" routes self-capture; "preview"
/// routes through the source picker. One-shot: resets to "preview" after read.
#[derive(Debug, Default)]
pub struct CaptureState {
    pub purpose: std::sync::Mutex<String>,
}

/// Pending source-picker resolution. When the portal/system enumerates
/// sources and emits `picker:request`, the renderer picks one and resolves
/// this via `select_source`.
#[derive(Debug, Default)]
pub struct PickerState {
    pub pending: std::sync::Mutex<Option<tokio::sync::oneshot::Sender<String>>>,
}

pub fn read_and_reset_purpose(state: &CaptureState) -> String {
    let mut guard = state
        .purpose
        .lock()
        .expect("capture purpose mutex poisoned");
    let current = guard.clone();
    *guard = "preview".to_string();
    current
}
