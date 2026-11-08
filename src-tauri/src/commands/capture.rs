use crate::state::{read_and_reset_purpose, CaptureState, PickerState};

/// Set the one-shot capture purpose before a `getDisplayMedia` / portal call.
/// Purpose "record" = self-capture for recording; "preview" = source picker.
/// Resets to "preview" after being read by the capture controller.
#[tauri::command]
pub fn set_capture_purpose(purpose: String, state: tauri::State<'_, CaptureState>) {
    if purpose == "record" || purpose == "preview" {
        let mut guard = state
            .purpose
            .lock()
            .expect("capture purpose mutex poisoned");
        *guard = purpose;
    }
}

/// Read and consume the pending purpose (resets to "preview").
/// Used internally by the capture controller (Phase C).
#[tauri::command]
pub fn get_capture_purpose(state: tauri::State<'_, CaptureState>) -> String {
    read_and_reset_purpose(&state)
}

/// Resolve the pending source picker with the chosen source id (or empty
/// string to cancel). The renderer calls this after the user picks a source
/// from the `picker:request` event.
#[tauri::command]
pub fn select_source(id: String, state: tauri::State<'_, PickerState>) {
    let mut guard = state.pending.lock().expect("picker mutex poisoned");
    if let Some(sender) = guard.take() {
        let _ = sender.send(id);
    }
}

/// Start screen preview using the portal and GStreamer pipeline.
#[tauri::command]
pub async fn start_screen_preview(
    handle: tauri::State<'_, crate::capture::sources::CaptureHandle>,
) -> Result<u32, String> {
    let session = crate::capture::portal::start_screencast().await?;
    let node_id = session.node_id;
    let pipeline = crate::capture::sources::PreviewPipeline::start(node_id)?;
    if let Ok(mut guard) = handle.pipeline.lock() {
        if let Some(mut old) = guard.take() {
            old.stop();
        }
        *guard = Some(pipeline);
    }
    Ok(node_id)
}

/// Stop the active screen preview pipeline.
#[tauri::command]
pub fn stop_screen_preview(handle: tauri::State<'_, crate::capture::sources::CaptureHandle>) {
    if let Ok(mut guard) = handle.pipeline.lock() {
        if let Some(mut pipeline) = guard.take() {
            pipeline.stop();
        }
    }
}
