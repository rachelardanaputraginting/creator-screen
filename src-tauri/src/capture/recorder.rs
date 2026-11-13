//! Native screen recorder.
//!
//! WebKitGTK's `getDisplayMedia` hands the renderer a display-capture stream
//! whose frames live in GPU memory (`memory:DMABuf`): the video element shows
//! them, but `drawImage()` reads back black and WebKit's MediaRecorder encodes
//! zero bytes. Rather than fight that, recording happens here in the Rust
//! process: the xdg-desktop-portal ScreenCast gives us a PipeWire node, and
//! GStreamer reads it into system memory (`videoconvert`), encodes VP8/Opus and
//! writes a WebM file. The renderer keeps `getDisplayMedia` only for the live
//! on-stage preview, which works fine.
//!
//! A recording lives in two places: the portal session (which must stay open
//! for as long as the stream is read) and the GStreamer pipeline. Both are
//! owned by one spawned task, so the session cannot be closed while the
//! pipeline still reads from it — the `stop` command only signals it.

use ashpd::desktop::screencast::{
    CursorMode, Screencast, SelectSourcesOptions, SourceType, StartCastOptions,
};
use ashpd::desktop::{PersistMode, ResponseError};
use gstreamer as gst;
use gstreamer::prelude::*;
use std::os::fd::AsRawFd;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::oneshot;

/// Emitted when the screencast ends on its own (the user stops sharing from
/// the desktop shell, or the shared window is closed). The renderer uses it to
/// finish the recording instead of showing a timer that never stops.
pub const RECORDING_ENDED_EVENT: &str = "screen-recording:ended";

/// How long the pipeline may take to deliver its first encoded frame before we
/// declare the capture broken. Without this a portal session that never sends
/// frames would look like a recording that silently produces 0 bytes.
const FIRST_FRAME_TIMEOUT: Duration = Duration::from_secs(15);

/// How long the muxer may take to finish after EOS.
const EOS_TIMEOUT: Duration = Duration::from_secs(20);

/// A finished native recording. The file sits in the app cache until the
/// renderer copies it wherever the user picks in the save dialog.
#[derive(Debug, Clone, serde::Serialize)]
pub struct RecordedFile {
    pub path: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StartOutcome {
    Started,
    Canceled,
}

enum StartFailure {
    Canceled,
    Failed(String),
}

struct RecorderRunning {
    stop_tx: oneshot::Sender<()>,
    done_rx: oneshot::Receiver<Result<RecordedFile, String>>,
}

/// Tauri managed state — one recording at a time.
#[derive(Default)]
pub struct RecorderState {
    running: Mutex<Option<RecorderRunning>>,
}

/// Start recording the source the user picks in the portal dialog.
///
/// Returns once frames are actually flowing, so the renderer only shows REC
/// for a capture that works.
pub async fn start_recording(
    app: tauri::AppHandle,
    state: &RecorderState,
    output: PathBuf,
    with_mic: bool,
    mic_label: Option<String>,
) -> Result<StartOutcome, String> {
    {
        let guard = state
            .running
            .lock()
            .map_err(|_| "Perekam sedang dipakai".to_string())?;
        if guard.is_some() {
            return Err("Perekaman sudah berjalan".to_string());
        }
    }

    let (stop_tx, stop_rx) = oneshot::channel::<()>();
    let (done_tx, done_rx) = oneshot::channel::<Result<RecordedFile, String>>();
    let (ready_tx, ready_rx) = oneshot::channel::<Result<(), StartFailure>>();

    tokio::spawn(async move {
        let result = run_recording(app, output, with_mic, mic_label, ready_tx, stop_rx).await;
        let _ = done_tx.send(result);
    });

    let ready = ready_rx
        .await
        .map_err(|_| "Perekam berhenti sebelum siap".to_string())?;

    match ready {
        Ok(()) => {
            let mut guard = state
                .running
                .lock()
                .map_err(|_| "Perekam sedang dipakai".to_string())?;
            *guard = Some(RecorderRunning { stop_tx, done_rx });
            Ok(StartOutcome::Started)
        }
        Err(StartFailure::Canceled) => Ok(StartOutcome::Canceled),
        Err(StartFailure::Failed(msg)) => Err(msg),
    }
}

/// Finish the running recording and return the file it produced.
pub async fn stop_recording(state: &RecorderState) -> Result<RecordedFile, String> {
    let running = {
        let mut guard = state
            .running
            .lock()
            .map_err(|_| "Perekam sedang dipakai".to_string())?;
        guard.take()
    };
    let running = running.ok_or_else(|| "Tidak ada perekaman yang aktif".to_string())?;

    let _ = running.stop_tx.send(());
    running
        .done_rx
        .await
        .map_err(|_| "Perekam berhenti tanpa hasil".to_string())?
}

/// The whole lifetime of one recording: portal session, pipeline, and file.
async fn run_recording(
    app: tauri::AppHandle,
    output: PathBuf,
    with_mic: bool,
    mic_label: Option<String>,
    ready: oneshot::Sender<Result<(), StartFailure>>,
    stop_rx: oneshot::Receiver<()>,
) -> Result<RecordedFile, String> {
    let mut ready = Some(ready);

    macro_rules! fail_start {
        ($msg:expr) => {{
            let msg: String = $msg;
            if let Some(tx) = ready.take() {
                let _ = tx.send(Err(StartFailure::Failed(msg.clone())));
            }
            return Err(msg);
        }};
    }

    macro_rules! cancel_start {
        () => {{
            if let Some(tx) = ready.take() {
                let _ = tx.send(Err(StartFailure::Canceled));
            }
            return Err(String::new());
        }};
    }

    let proxy = match Screencast::new().await {
        Ok(proxy) => proxy,
        Err(err) => fail_start!(format!("Portal berbagi layar tidak tersedia: {err}")),
    };

    let session = match proxy.create_session(Default::default()).await {
        Ok(session) => session,
        Err(err) => fail_start!(format!("Gagal membuat sesi berbagi layar: {err}")),
    };

    let select = proxy
        .select_sources(
            &session,
            SelectSourcesOptions::default()
                .set_cursor_mode(CursorMode::METADATA)
                .set_sources(SourceType::MONITOR | SourceType::WINDOW)
                .set_multiple(false)
                .set_persist_mode(PersistMode::DoNot),
        )
        .await;
    match select {
        Ok(request) => {
            if request.response().is_err() {
                cancel_start!();
            }
        }
        Err(err) => fail_start!(format!("Gagal menyiapkan sumber layar: {err}")),
    }

    let streams = match proxy
        .start(&session, None, StartCastOptions::default())
        .await
    {
        Ok(request) => match request.response() {
            Ok(streams) => streams,
            Err(ashpd::Error::Response(ResponseError::Cancelled)) => cancel_start!(),
            Err(err) => fail_start!(format!("Dialog berbagi layar gagal: {err}")),
        },
        Err(ashpd::Error::Response(ResponseError::Cancelled)) => cancel_start!(),
        Err(err) => fail_start!(format!("Dialog berbagi layar gagal: {err}")),
    };

    let Some(stream) = streams.streams().first() else {
        fail_start!("Tidak ada layar atau jendela yang dipilih.".to_string());
    };
    let node_id = stream.pipe_wire_node_id();

    let fd = match proxy
        .open_pipe_wire_remote(&session, Default::default())
        .await
    {
        Ok(fd) => fd,
        Err(err) => fail_start!(format!("Tidak bisa membuka koneksi PipeWire: {err}")),
    };
    let raw_fd = fd.as_raw_fd();

    // GStreamer setup blocks (first-frame wait), so keep it off the async
    // runtime. The OwnedFd stays here for as long as the pipeline runs.
    let destination = output.clone();
    let started = tokio::task::spawn_blocking(move || {
        start_pipeline(node_id, raw_fd, &destination, with_mic, mic_label.as_deref())
    })
    .await;

    let StartedPipeline { pipeline, bus } = match started {
        Ok(Ok(started)) => started,
        Ok(Err(err)) => fail_start!(err),
        Err(err) => fail_start!(format!("Gagal menyiapkan perekaman: {err}")),
    };

    if let Some(tx) = ready.take() {
        let _ = tx.send(Ok(()));
    }

    let mut stop_rx = stop_rx;
    let mut bus_wait = tokio::task::spawn_blocking(move || wait_for_end(bus));

    let mut ended = None;
    let mut ended_by_itself = false;
    tokio::select! {
        _ = &mut stop_rx => {}
        joined = &mut bus_wait => {
            ended = Some(join_result(joined));
            ended_by_itself = true;
        }
    }

    if ended.is_none() {
        let _ = pipeline.send_event(gst::event::Eos::new());
        ended = Some(match tokio::time::timeout(EOS_TIMEOUT, bus_wait).await {
            Ok(joined) => join_result(joined),
            Err(_) => {
                log::warn!(
                    "rekaman: aliran tidak berakhir dalam {}s",
                    EOS_TIMEOUT.as_secs()
                );
                Ok(())
            }
        });
    }

    let _ = pipeline.set_state(gst::State::Null);

    let bus_result = ended.unwrap_or(Ok(()));

    // Close the portal session last: the pipeline must be done with the
    // PipeWire node before the compositor tears the stream down.
    if let Err(err) = session.close().await {
        log::warn!("rekaman: gagal menutup sesi portal: {err}");
    }
    drop(fd);

    if let Err(err) = bus_result {
        let _ = std::fs::remove_file(&output);
        return Err(format!("Perekaman gagal: {err}"));
    }

    let bytes = std::fs::metadata(&output).map(|m| m.len()).unwrap_or(0);
    if bytes == 0 {
        let _ = std::fs::remove_file(&output);
        return Err(
            "Rekaman kosong (0 bytes). Pastikan jendela yang dibagikan menampilkan konten."
                .to_string(),
        );
    }

    // The screencast can end on its own; tell the renderer so the timer stops
    // instead of running until the user presses Stop.
    if ended_by_itself {
        use tauri::Emitter;
        let _ = app.emit(RECORDING_ENDED_EVENT, ());
    }

    Ok(RecordedFile {
        path: output.to_string_lossy().to_string(),
        bytes,
    })
}

fn join_result(joined: Result<Result<(), String>, tokio::task::JoinError>) -> Result<(), String> {
    match joined {
        Ok(result) => result,
        Err(err) => Err(format!("pemantau pipeline berhenti: {err}")),
    }
}

struct StartedPipeline {
    pipeline: gst::Pipeline,
    bus: gst::Bus,
}

fn make(factory: &str, label: &str) -> Result<gst::Element, String> {
    gst::ElementFactory::make(factory)
        .build()
        .map_err(|err| format!("{label} ({factory}) tidak tersedia: {err}"))
}

/// Map the microphone the renderer reports (its device label, e.g. "Headset
/// Microphone") to the PulseAudio source name `pulsesrc` needs. PipeWire does
/// not always repoint the default source at a freshly plugged headset, so we
/// look the chosen device up ourselves and record it explicitly. Returns
/// `None` (→ keeps the default source) when there is no label or no match.
fn resolve_mic_source(label: Option<&str>) -> Option<String> {
    let label = label?.trim();
    if label.is_empty() {
        return None;
    }

    let monitor = gst::DeviceMonitor::new();
    monitor.set_show_all_devices(true);
    // Restrict to capture devices: otherwise the output sink (which on a
    // single-card machine shares the same description) could be matched and
    // `pulsesrc` would record the monitor instead of the microphone.
    monitor.add_filter(Some("Audio/Source"), None);
    if monitor.start().is_err() {
        return None;
    }

    for device in monitor.devices() {
        if device.device_class().as_str() != "Audio/Source" {
            continue;
        }
        let display = device.display_name().to_string();
        let matched = display.eq_ignore_ascii_case(label)
            || display.to_lowercase().contains(&label.to_lowercase())
            || label.to_lowercase().contains(&display.to_lowercase());
        if !matched {
            continue;
        }
        if let Some(props) = device.properties() {
            // `node.name` is exactly the PulseAudio/PipeWire source name
            // `pulsesrc device=` accepts, e.g. "alsa_input.pci-…analog-stereo"
            // or "bluez_input.XX.YY".
            if let Ok(node) = props.get::<String>("node.name") {
                if !node.trim().is_empty() {
                    monitor.stop();
                    return Some(node);
                }
            }
        }
    }

    monitor.stop();
    None
}

fn audio_chain(mic_label: Option<&str>) -> Result<Vec<gst::Element>, String> {
    let src = make("pulsesrc", "Sumber mikrofon")?;
    // Capture the device the user actually picked instead of whatever PipeWire
    // currently calls "default" (a headset plugged in mid-session is often not
    // it). Without a match we keep the default source, which still works.
    if let Some(device) = resolve_mic_source(mic_label) {
        src.set_property("device", device);
    }
    let convert_in = make("audioconvert", "Konversi audio")?;

    // The browser mic path runs the signal through WebRTC's noise suppression,
    // high-pass filter and AGC before it reaches the recording. `pulsesrc` has
    // none of that, so a raw default-device capture sounds far noisier (fan,
    // room, mains hum) than what the user picked the mic from. `webrtcdsp` is
    // that same processing in one element; feed it the S16 mono 48 kHz form it
    // accepts. Without the plugin we still record the mic unprocessed instead
    // of dropping audio entirely.
    let dsp_caps = gst::Caps::builder("audio/x-raw")
        .field("format", "S16LE")
        .field("layout", "interleaved")
        .field("rate", 48_000i32)
        .field("channels", 1i32)
        .build();
    let dsp_filter = make("capsfilter", "Format mikrofon")?;
    dsp_filter.set_property("caps", &dsp_caps);

    let mut chain: Vec<gst::Element> = vec![src, convert_in, dsp_filter];
    match make("webrtcdsp", "Perapi suara") {
        Ok(dsp) => {
            // echo-cancel stays off: a recording has no far-end (speaker
            // output) to cancel against, and enabling it without a probe
            // reference makes the element refuse to start.
            dsp.set_property("echo-cancel", false);
            dsp.set_property("noise-suppression", true);
            // Enum property: the Rust bindings can't set it from a bare int,
            // so set it through the enum nick ("low" | "moderate" | "high").
            dsp.set_property_from_str("noise-suppression-level", "high");
            dsp.set_property("gain-control", true);
            dsp.set_property("high-pass-filter", true);
            chain.push(dsp);
        }
        Err(err) => log::warn!(
            "rekaman: perapi suara tidak tersedia ({err}); mikrofon direkam tanpa pengurangan derau"
        ),
    }

    let convert_out = make("audioconvert", "Konversi audio keluaran")?;
    let resample = make("audioresample", "Resample audio")?;
    let out_caps = gst::Caps::builder("audio/x-raw")
        .field("rate", 48_000i32)
        .field("channels", 1i32)
        .build();
    let out_filter = make("capsfilter", "Filter audio")?;
    out_filter.set_property("caps", &out_caps);

    let encoder = make("opusenc", "Encoder Opus")?;
    encoder.set_property("bitrate", 128_000i32);

    chain.extend([convert_out, resample, out_filter, encoder]);
    Ok(chain)
}

/// Build and start the WebM pipeline, then wait until a real frame lands.
fn start_pipeline(
    node_id: u32,
    raw_fd: i32,
    output: &Path,
    with_mic: bool,
    mic_label: Option<&str>,
) -> Result<StartedPipeline, String> {
    gst::init().map_err(|err| format!("GStreamer tidak bisa diinisialisasi: {err}"))?;

    let pipeline = gst::Pipeline::new();

    let src = make("pipewiresrc", "Sumber PipeWire")?;
    src.set_property("path", node_id.to_string());
    src.set_property("fd", raw_fd);
    src.set_property("do-timestamp", true);
    // A stream the user ends from the desktop shell should finish the file
    // instead of stalling the pipeline forever.
    src.set_property_from_str("on-disconnect", "eos");

    let convert = make("videoconvert", "Konversi warna")?;
    let rate = make("videorate", "Penyesuai frame rate")?;
    let caps = gst::Caps::builder("video/x-raw")
        .field("framerate", gst::Fraction::new(30, 1))
        .build();
    let filter = make("capsfilter", "Filter frame rate")?;
    filter.set_property("caps", &caps);

    let encoder = make("vp8enc", "Encoder VP8")?;
    encoder.set_property("deadline", 1i64); // 1 = realtime
    encoder.set_property("cpu-used", 8i32);
    encoder.set_property("target-bitrate", 8_000_000i32);
    encoder.set_property("keyframe-max-dist", 150i32);

    let mux = make("webmmux", "Pengemas WebM")?;
    // Default (non-streamable) mode: the muxer writes cues and a real duration
    // when it receives EOS, which is what makes the file seekable in ordinary
    // players. Every stop path here sends EOS first.

    let sink = make("filesink", "Berkas rekaman")?;
    sink.set_property("location", output.to_string_lossy().to_string());

    pipeline
        .add_many([&src, &convert, &rate, &filter, &encoder, &mux, &sink])
        .map_err(|err| format!("Gagal merakit pipeline rekaman: {err}"))?;
    gst::Element::link_many([&src, &convert, &rate, &filter, &encoder])
        .map_err(|err| format!("Gagal menghubungkan pipeline rekaman: {err}"))?;

    let video_pad = mux
        .request_pad_simple("video_%u")
        .ok_or_else(|| "Pengemas WebM tidak menerima video".to_string())?;
    let encoded = encoder
        .static_pad("src")
        .ok_or_else(|| "Encoder tidak punya keluaran".to_string())?;
    encoded
        .link(&video_pad)
        .map_err(|err| format!("Gagal menghubungkan video ke pengemas: {err}"))?;
    mux.link(&sink)
        .map_err(|err| format!("Gagal menghubungkan pengemas ke berkas: {err}"))?;

    if with_mic {
        match audio_chain(mic_label) {
            Ok(chain) => {
                let added = pipeline.add_many(chain.iter()).is_ok()
                    && gst::Element::link_many(chain.iter()).is_ok();
                let linked = added
                    && chain
                        .last()
                        .and_then(|enc| enc.static_pad("src"))
                        .zip(mux.request_pad_simple("audio_%u"))
                        .map(|(src, pad)| src.link(&pad).is_ok())
                        .unwrap_or(false);
                if !linked {
                    // A missing microphone must not cost the user the video.
                    log::warn!("rekaman: jalur mikrofon gagal disiapkan, merekam tanpa audio");
                }
            }
            Err(err) => log::warn!("rekaman: mikrofon tidak tersedia ({err}), merekam tanpa audio"),
        }
    }

    let bus = pipeline
        .bus()
        .ok_or_else(|| "Pipeline rekaman tidak punya bus".to_string())?;

    // Watch for the first encoded frame so a session that silently delivers
    // nothing fails here instead of producing an empty file.
    let got_frame = Arc::new(AtomicBool::new(false));
    let flag = got_frame.clone();
    let probe = encoded.add_probe(gst::PadProbeType::BUFFER, move |_, _| {
        flag.store(true, Ordering::Release);
        gst::PadProbeReturn::Ok
    });

    let started = pipeline
        .set_state(gst::State::Playing)
        .map_err(|err| format!("Gagal menjalankan perekaman: {err}"));
    if let Err(err) = started {
        if let Some(id) = probe {
            encoded.remove_probe(id);
        }
        let _ = pipeline.set_state(gst::State::Null);
        return Err(err);
    }

    let deadline = Instant::now() + FIRST_FRAME_TIMEOUT;
    while !got_frame.load(Ordering::Acquire) && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(20));
    }
    if let Some(id) = probe {
        encoded.remove_probe(id);
    }

    if !got_frame.load(Ordering::Acquire) {
        let _ = pipeline.set_state(gst::State::Null);
        let _ = std::fs::remove_file(output);
        return Err(
            "Layar tidak mengirim gambar. Pastikan jendela yang dibagikan terlihat (tidak diminimalkan), lalu coba lagi."
                .to_string(),
        );
    }

    Ok(StartedPipeline { pipeline, bus })
}

/// Block until the pipeline reaches EOS or reports an error.
fn wait_for_end(bus: gst::Bus) -> Result<(), String> {
    loop {
        let message = bus.timed_pop_filtered(
            gst::ClockTime::from_seconds(1),
            &[gst::MessageType::Eos, gst::MessageType::Error],
        );

        match message {
            None => continue,
            Some(message) => match message.view() {
                gst::MessageView::Eos(_) => return Ok(()),
                gst::MessageView::Error(err) => {
                    let debug = err.debug().map(|d| d.to_string()).unwrap_or_default();
                    return Err(if debug.is_empty() {
                        format!("{}", err.error())
                    } else {
                        format!("{} ({debug})", err.error())
                    });
                }
                _ => continue,
            },
        }
    }
}

/// Remove recordings left behind by earlier runs. They exist only to be copied
/// to the user's chosen destination, so a day-old one is dead weight.
pub fn sweep_old_recordings(dir: &Path, keep: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let now = std::time::SystemTime::now();
    for entry in entries.flatten() {
        let path = entry.path();
        if path == keep {
            continue;
        }
        let old = entry
            .metadata()
            .ok()
            .and_then(|meta| meta.modified().ok())
            .and_then(|modified| now.duration_since(modified).ok())
            .map(|age| age.as_secs() > 24 * 60 * 60)
            .unwrap_or(false);
        if old {
            let _ = std::fs::remove_file(&path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "creator-screen-recorder-{tag}-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn sweep_keeps_the_current_recording() {
        let dir = temp_dir("sweep");
        let keep = dir.join("current.webm");
        let fresh = dir.join("fresh.webm");
        std::fs::write(&keep, b"a").unwrap();
        std::fs::write(&fresh, b"b").unwrap();

        sweep_old_recordings(&dir, &keep);

        assert!(keep.exists());
        assert!(fresh.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sweep_ignores_a_missing_folder() {
        sweep_old_recordings(
            Path::new("/nonexistent-creator-screen/recordings"),
            Path::new("/nonexistent-creator-screen/recordings/x.webm"),
        );
    }
}
