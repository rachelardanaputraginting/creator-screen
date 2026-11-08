use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SaveRecordingResult {
    pub saved: bool,
    pub path: Option<String>,
    pub canceled: Option<bool>,
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
