mod capture;
mod commands;
mod state;

use capture::sources::CaptureHandle;
use state::{CaptureState, PickerState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .on_permission_request(|_webview, kind| match kind {
            tauri::webview::PermissionKind::Camera
            | tauri::webview::PermissionKind::Microphone
            | tauri::webview::PermissionKind::DisplayCapture => {
                tauri::webview::PermissionResponse::Allow
            }
            _ => tauri::webview::PermissionResponse::Default,
        })
        .register_uri_scheme_protocol("screen-frame", |ctx, request| {
            let path = request.uri().path();
            let handle = ctx.app_handle().state::<CaptureHandle>();
            let jpeg = handle
                .pipeline
                .lock()
                .ok()
                .and_then(|g| g.as_ref().map(|p| p.frame_buffer().get()))
                .unwrap_or_default();

            if jpeg.is_empty() || !path.ends_with("frame") {
                return tauri::http::Response::builder()
                    .status(tauri::http::StatusCode::NOT_FOUND)
                    .header(tauri::http::header::CONTENT_TYPE, "image/jpeg")
                    .body(Vec::new())
                    .unwrap();
            }

            tauri::http::Response::builder()
                .status(tauri::http::StatusCode::OK)
                .header(tauri::http::header::CONTENT_TYPE, "image/jpeg")
                .header(tauri::http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(jpeg)
                .unwrap()
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .manage(CaptureState::default())
        .manage(PickerState::default())
        .manage(CaptureHandle::default())
        .invoke_handler(tauri::generate_handler![
            commands::platform::get_platform,
            commands::capture::set_capture_purpose,
            commands::capture::get_capture_purpose,
            commands::capture::select_source,
            commands::capture::start_screen_preview,
            commands::capture::stop_screen_preview,
            commands::recording::save_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
