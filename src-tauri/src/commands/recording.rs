use crate::capture::recorder::{self, RecordedFile, RecorderState};
use crate::state::{RecordingSink, SaveRecordingResult, StartRecordingResult};
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const DEFAULT_NAME: &str = "creator-screen.mp4";

/// Keep only the file name — a renderer payload must never choose a folder.
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
    if data.is_empty() {
        return Err("Data rekaman kosong (0 bytes)".to_string());
    }

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
                bytes: None,
            });
        }
    };

    // Ensure the saved file always has a valid video extension (.webm or .mp4).
    // On Linux (GTK / XDG portal), dialogs can omit the extension if not typed explicitly,
    // which causes the desktop environment to treat the file as plain text / application/x-zerosize!
    let mut final_path = save_path;
    if final_path.extension().is_none() {
        let ext = exts.first().unwrap_or(&"webm");
        final_path.set_extension(ext);
    }

    std::fs::write(&final_path, &data).map_err(|e| e.to_string())?;

    Ok(SaveRecordingResult {
        saved: true,
        path: final_path.to_str().map(|s| s.to_string()),
        canceled: Some(false),
        bytes: Some(data.len() as u64),
    })
}

/// A hidden sibling of `final_path` that the bytes are written to first.
fn part_path_for(final_path: &Path) -> PathBuf {
    let file_name = final_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(DEFAULT_NAME);
    let mut part = final_path.to_path_buf();
    part.set_file_name(format!(".{file_name}.{}.part", uuid::Uuid::new_v4()));
    part
}

impl crate::state::RecordingTarget {
    /// Open a hidden temp file next to the destination the user chose.
    fn create(final_path: PathBuf) -> Result<Self, String> {
        let parent = match final_path.parent() {
            Some(p) if !p.as_os_str().is_empty() => p.to_path_buf(),
            _ => PathBuf::from("."),
        };
        if !parent.is_dir() {
            return Err(format!(
                "Folder tujuan tidak ditemukan: {}",
                parent.display()
            ));
        }

        let part_path = part_path_for(&final_path);
        let file = File::create(&part_path)
            .map_err(|e| format!("Tidak bisa menulis {}: {e}", part_path.display()))?;

        Ok(Self {
            final_path,
            part_path,
            file: Some(file),
        })
    }

    fn write(&mut self, bytes: &[u8]) -> Result<(), String> {
        let file = self
            .file
            .as_mut()
            .ok_or_else(|| "Penyimpanan rekaman sudah ditutup".to_string())?;
        file.write_all(bytes)
            .map_err(|e| format!("Gagal menulis rekaman: {e}"))
    }

    /// Flush, then publish the temp file under the name the user picked.
    fn finish(mut self) -> Result<SaveRecordingResult, String> {
        let mut file = self
            .file
            .take()
            .ok_or_else(|| "Penyimpanan rekaman sudah ditutup".to_string())?;
        file.flush()
            .and_then(|_| file.sync_all())
            .map_err(|e| format!("Gagal menyelesaikan rekaman: {e}"))?;
        drop(file);

        // Rename into place only once every byte is on disk. A failed save
        // leaves the user's previous file untouched. Windows refuses to rename
        // over an existing file, so remove the agreed overwrite target first.
        if self.final_path.exists() {
            std::fs::remove_file(&self.final_path)
                .map_err(|e| format!("Gagal mengganti file lama: {e}"))?;
        }
        std::fs::rename(&self.part_path, &self.final_path)
            .map_err(|e| format!("Gagal menyimpan {}: {e}", self.final_path.display()))?;

        let bytes = std::fs::metadata(&self.final_path)
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(SaveRecordingResult {
            saved: true,
            path: self.final_path.to_str().map(|s| s.to_string()),
            canceled: Some(false),
            bytes: Some(bytes),
        })
    }

    /// Throw the in-flight bytes away, temp file included.
    fn discard(self) {
        drop(self.file);
        let _ = std::fs::remove_file(&self.part_path);
    }
}

fn lock_sink(
    sink: &RecordingSink,
) -> Result<std::sync::MutexGuard<'_, Option<crate::state::RecordingTarget>>, String> {
    sink.target
        .lock()
        .map_err(|_| "Penyimpanan rekaman sedang dipakai".to_string())
}

/// Open the destination for a chunked save.
///
/// Called once per save, before the first chunk. Any previous unfinished save
/// is discarded (and its temp file removed) so a retry cannot append to stale
/// bytes.
#[tauri::command]
pub fn save_recording_begin(
    sink: tauri::State<'_, RecordingSink>,
    path: String,
) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Lokasi penyimpanan kosong".to_string());
    }

    let mut guard = lock_sink(&sink)?;
    if let Some(previous) = guard.take() {
        previous.discard();
    }
    *guard = Some(crate::state::RecordingTarget::create(PathBuf::from(
        trimmed,
    ))?);
    Ok(())
}

/// Append one raw byte chunk to the open save.
///
/// The payload arrives as `application/octet-stream` (a `Uint8Array` on the
/// renderer side), so megabytes cross the IPC boundary without being expanded
/// into a JSON number array first.
#[tauri::command]
pub fn save_recording_write(
    sink: tauri::State<'_, RecordingSink>,
    request: tauri::ipc::Request<'_>,
) -> Result<usize, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.as_slice(),
        _ => return Err("Payload rekaman harus berupa byte mentah".to_string()),
    };

    let mut guard = lock_sink(&sink)?;
    let target = guard
        .as_mut()
        .ok_or_else(|| "Tidak ada penyimpanan rekaman yang aktif".to_string())?;
    target.write(bytes)?;
    Ok(bytes.len())
}

/// Flush the open save and publish it under the chosen name.
#[tauri::command]
pub fn save_recording_finish(
    sink: tauri::State<'_, RecordingSink>,
) -> Result<SaveRecordingResult, String> {
    lock_sink(&sink)?
        .take()
        .ok_or_else(|| "Tidak ada penyimpanan rekaman yang aktif".to_string())?
        .finish()
}

/// Drop the in-flight save and delete its temp file (used on failure).
#[tauri::command]
pub fn save_recording_abort(sink: tauri::State<'_, RecordingSink>) -> Result<(), String> {
    if let Some(target) = lock_sink(&sink)?.take() {
        target.discard();
    }
    Ok(())
}

/// Folder that holds the recordings the native recorder writes.
///
/// The renderer never sees this path as a destination: it exists so the
/// recording keeps running independently of the save dialog, and is copied to
/// wherever the user picks afterwards.
fn recording_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Folder cache aplikasi tidak tersedia: {e}"))?
        .join("recordings");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Tidak bisa membuat folder rekaman {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Start recording the screen/window picked in the portal dialog.
///
/// On Linux the backend records natively: WebKitGTK's display-capture frames
/// cannot be encoded by MediaRecorder here, so capturing in the renderer would
/// only ever produce a 0-byte file.
#[tauri::command]
pub async fn start_screen_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, RecorderState>,
    with_mic: bool,
    mic_device: Option<String>,
) -> Result<StartRecordingResult, String> {
    let dir = recording_dir(&app)?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let output = dir.join(format!("creator-screen-{stamp}.webm"));
    recorder::sweep_old_recordings(&dir, &output);

    match recorder::start_recording(app, &state, output, with_mic, mic_device).await? {
        recorder::StartOutcome::Started => Ok(StartRecordingResult {
            ok: true,
            canceled: false,
        }),
        recorder::StartOutcome::Canceled => Ok(StartRecordingResult {
            ok: false,
            canceled: true,
        }),
    }
}

/// Finish the native recording and report the file it produced.
#[tauri::command]
pub async fn stop_screen_recording(
    state: tauri::State<'_, RecorderState>,
) -> Result<RecordedFile, String> {
    recorder::stop_recording(&state).await
}

/// Copy a finished recording to the destination the user picked.
///
/// Same publish guarantee as the chunked save: bytes land in a hidden sibling
/// first and are renamed into place, so a failure can never leave a truncated
/// video under the name the user chose.
#[tauri::command]
pub async fn save_recording_file(
    source: String,
    target: String,
) -> Result<SaveRecordingResult, String> {
    let source_path = PathBuf::from(source.trim());
    if !source_path.is_file() {
        return Err(format!(
            "Berkas rekaman tidak ditemukan: {}",
            source_path.display()
        ));
    }

    let source_bytes = std::fs::metadata(&source_path)
        .map(|m| m.len())
        .unwrap_or(0);
    if source_bytes == 0 {
        return Err("Data rekaman kosong (0 bytes)".to_string());
    }

    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err("Lokasi penyimpanan kosong".to_string());
    }
    let final_path = PathBuf::from(trimmed);
    let parent = match final_path.parent() {
        Some(p) if !p.as_os_str().is_empty() => p.to_path_buf(),
        _ => PathBuf::from("."),
    };
    if !parent.is_dir() {
        return Err(format!(
            "Folder tujuan tidak ditemukan: {}",
            parent.display()
        ));
    }

    let part_path = part_path_for(&final_path);
    if let Err(err) = std::fs::copy(&source_path, &part_path) {
        let _ = std::fs::remove_file(&part_path);
        return Err(format!("Gagal menulis rekaman: {err}"));
    }

    if final_path.exists() {
        if let Err(err) = std::fs::remove_file(&final_path) {
            let _ = std::fs::remove_file(&part_path);
            return Err(format!("Gagal mengganti file lama: {err}"));
        }
    }
    if let Err(err) = std::fs::rename(&part_path, &final_path) {
        let _ = std::fs::remove_file(&part_path);
        return Err(format!("Gagal menyimpan {}: {err}", final_path.display()));
    }

    let bytes = std::fs::metadata(&final_path).map(|m| m.len()).unwrap_or(0);
    Ok(SaveRecordingResult {
        saved: true,
        path: final_path.to_str().map(|s| s.to_string()),
        canceled: Some(false),
        bytes: Some(bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::RecordingTarget;

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
    }

    #[test]
    fn part_file_is_a_hidden_sibling() {
        let finished = Path::new("/home/user/Videos/Rekaman Saya.webm");
        let part = part_path_for(finished);

        assert_eq!(part.parent(), finished.parent());
        assert!(part != finished, "temp file must not be the final name");
        let name = part.file_name().unwrap().to_str().unwrap();
        assert!(name.starts_with(".Rekaman Saya.webm."));
        assert!(name.ends_with(".part"));
        assert_eq!(part.extension().and_then(|e| e.to_str()), Some("part"));
    }

    #[test]
    fn part_file_names_do_not_collide() {
        let finished = Path::new("/tmp/recording.mp4");
        assert_ne!(part_path_for(finished), part_path_for(finished));
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("creator-screen-{tag}-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn chunked_save_publishes_every_byte_at_the_end() {
        let dir = temp_dir("save");
        let final_path = dir.join("Rekaman Saya.webm");
        let mut target = RecordingTarget::create(final_path.clone()).unwrap();

        target.write(b"hello ").unwrap();
        target.write(b"world").unwrap();

        // The chosen name must stay free until the save is complete.
        assert!(!final_path.exists());

        let result = target.finish().unwrap();
        assert!(result.saved);
        assert_eq!(result.bytes, Some(11));
        assert_eq!(result.path.as_deref(), Some(final_path.to_str().unwrap()));
        assert_eq!(std::fs::read(&final_path).unwrap(), b"hello world");

        // Nothing but the finished file remains.
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn abort_deletes_the_temp_file_and_never_touches_the_target() {
        let dir = temp_dir("abort");
        let final_path = dir.join("recording.webm");
        let mut target = RecordingTarget::create(final_path.clone()).unwrap();
        target.write(b"partial").unwrap();

        target.discard();

        assert!(!final_path.exists());
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn finish_overwrites_an_existing_recording() {
        let dir = temp_dir("replace");
        let final_path = dir.join("recording.mp4");
        std::fs::write(&final_path, b"old recording").unwrap();

        let mut target = RecordingTarget::create(final_path.clone()).unwrap();
        target.write(b"new").unwrap();
        target.finish().unwrap();

        assert_eq!(std::fs::read(&final_path).unwrap(), b"new");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn begin_refuses_a_missing_folder() {
        let final_path = PathBuf::from("/nonexistent-creator-screen/dir/recording.webm");
        assert!(RecordingTarget::create(final_path).is_err());
    }

    /// The renderer sends chunks as raw IPC bodies (`application/octet-stream`),
    /// so exercise the real command path rather than only the file helpers.
    #[test]
    fn ipc_round_trip_writes_the_whole_recording() {
        use tauri::ipc::{CallbackFn, InvokeBody};
        use tauri::test::{INVOKE_KEY, get_ipc_response, mock_builder, mock_context, noop_assets};
        use tauri::webview::InvokeRequest;

        let app = mock_builder()
            .manage(RecordingSink::default())
            .invoke_handler(tauri::generate_handler![
                save_recording_begin,
                save_recording_write,
                save_recording_finish,
                save_recording_abort
            ])
            .build(mock_context(noop_assets()))
            .expect("build mock app");
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("build mock webview");

        let dir = temp_dir("ipc");
        let final_path = dir.join("rekaman.webm");

        let invoke = |cmd: &str, body: InvokeBody| {
            get_ipc_response(
                &webview,
                InvokeRequest {
                    cmd: cmd.into(),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse().unwrap(),
                    body,
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.to_string(),
                },
            )
        };

        let path_json = serde_json::json!({ "path": final_path.to_str().unwrap() });
        invoke("save_recording_begin", InvokeBody::Json(path_json)).expect("begin");

        invoke(
            "save_recording_write",
            InvokeBody::Raw(b"frame-one;".to_vec()),
        )
        .expect("first chunk");
        invoke(
            "save_recording_write",
            InvokeBody::Raw(b"frame-two;".to_vec()),
        )
        .expect("second chunk");

        let result = invoke(
            "save_recording_finish",
            InvokeBody::Json(serde_json::json!({})),
        )
        .expect("finish")
        .deserialize::<serde_json::Value>()
        .expect("finish payload");

        assert_eq!(result["saved"], true);
        assert_eq!(result["bytes"], 20);
        assert_eq!(std::fs::read(&final_path).unwrap(), b"frame-one;frame-two;");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
