use crate::state::SaveRecordingResult;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;

const DEFAULT_NAME: &str = "creator-screen.mp4";

/// Keep only the file name — a renderer payload must never choose a folder.
/// Mirrors `safeFileName` from `electron/save-recording.js`.
fn safe_file_name(file_name: &str) -> String {
    let raw = file_name.trim();
    if raw.is_empty() {
        return DEFAULT_NAME.to_string();
    }
    // Normalize backslashes to forward slashes, then take the basename.
    let normalized: String = raw.replace('\\', "/");
    let base = Path::new(&normalized)
        .file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_NAME.to_string());
    base
}

/// Derive a file-extension filter from the default file name.
fn filter_for(name: &str) -> Vec<&'static str> {
    match Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("mp4") => vec!["mp4"],
        Some("webm") => vec!["webm"],
        Some("mkv") => vec!["mkv"],
        _ => vec!["mp4"],
    }
}

/// Save a recording blob to disk via a native save dialog.
///
/// Bypasses any browser downloader for the same reason as the Electron
/// predecessor: a downloader parks `<uuid>.tmp` in Downloads and only renames
/// once the save is applied, so a cancelled dialog strands the temp file.
///
/// `data` arrives as a JSON array of bytes from the Tauri IPC layer. In
/// Phase D this command is superseded by `stop_recording`, which writes the
/// file directly from the GStreamer pipeline — no IPC blob transfer needed.
#[tauri::command]
pub async fn save_recording(
    app: tauri::AppHandle,
    data: Vec<u8>,
    file_name: String,
) -> Result<SaveRecordingResult, String> {
    let name = safe_file_name(&file_name);
    let exts = filter_for(&name);

    let path = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter("Video", &exts)
        .blocking_save_file();

    let save_path: PathBuf = match path {
        Some(p) => p.into_path().map_err(|e| e.to_string())?,
        None => {
            return Ok(SaveRecordingResult {
                saved: false,
                path: None,
                canceled: Some(true),
            });
        }
    };

    std::fs::write(&save_path, &data).map_err(|e| e.to_string())?;

    Ok(SaveRecordingResult {
        saved: true,
        path: save_path.to_str().map(|s| s.to_string()),
        canceled: Some(false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_name_strips_paths() {
        assert_eq!(safe_file_name("/etc/passwd"), "passwd");
        assert_eq!(safe_file_name("..\\evil\\x.mp4"), "x.mp4");
        assert_eq!(safe_file_name(""), DEFAULT_NAME);
        assert_eq!(safe_file_name("   "), DEFAULT_NAME);
        assert_eq!(safe_file_name("rec.mp4"), "rec.mp4");
    }

    #[test]
    fn filter_derived_from_extension() {
        assert_eq!(filter_for("rec.mp4"), vec!["mp4"]);
        assert_eq!(filter_for("rec.webm"), vec!["webm"]);
        assert_eq!(filter_for("rec"), vec!["mp4"]);
    }}
