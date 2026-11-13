use gstreamer as gst;
use gstreamer::glib;
use gstreamer::prelude::*;
use gstreamer_app as gst_app;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

/// Latest captured frame as JPEG bytes, served to the WebView via a custom
/// protocol handler. The WebView polls `tauri://localhost/screen-frame` (or
/// uses a streaming MJPEG endpoint) to display the live screen preview.
#[derive(Clone)]
pub struct FrameBuffer {
    inner: Arc<Mutex<Vec<u8>>>,
    dirty: Arc<AtomicBool>,
}

impl FrameBuffer {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Vec::new())),
            dirty: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn set(&self, data: Vec<u8>) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = data;
            self.dirty.store(true, Ordering::Release);
        }
    }

    /// Returns a snapshot of the current frame. The clone is cheap relative to
    /// a JPEG encode, and avoids holding the lock across the protocol response.
    pub fn get(&self) -> Vec<u8> {
        self.inner.lock().map(|g| g.clone()).unwrap_or_default()
    }

    #[allow(dead_code)]
    pub fn is_dirty(&self) -> bool {
        self.dirty.swap(false, Ordering::AcqRel)
    }
}

/// Manages the GStreamer preview pipeline: `pipewiresrc → videoconvert →
/// jpegenc → appsink`. The appsink's `new-sample` callback pushes each JPEG
/// into the `FrameBuffer` so the custom protocol can serve it to the WebView.
pub struct PreviewPipeline {
    pipeline: gst::Pipeline,
    frame_buffer: FrameBuffer,
    bus_watch: Option<gst::bus::BusWatchGuard>,
}

impl PreviewPipeline {
    /// Build and start the preview pipeline from a PipeWire node id.
    pub fn start(node_id: u32) -> Result<Self, String> {
        gst::init().map_err(|e| format!("GStreamer init failed: {}", e))?;

        let pipeline = gst::Pipeline::new();
        let src = gst::ElementFactory::make("pipewiresrc")
            .property("path", node_id.to_string())
            .build()
            .map_err(|e| format!("pipewiresrc: {}", e))?;
        let convert = gst::ElementFactory::make("videoconvert")
            .build()
            .map_err(|e| format!("videoconvert: {}", e))?;
        let scale = gst::ElementFactory::make("videoscale")
            .build()
            .map_err(|e| format!("videoscale: {}", e))?;
        // Cap the preview at 1280-wide to keep the JPEG encode + IPC cheap.
        let caps = gstreamer_video::VideoCapsBuilder::new()
            .width(1280)
            .framerate(gst::Fraction::new(30, 1))
            .build();
        let capsfilter = gst::ElementFactory::make("capsfilter")
            .property("caps", &caps)
            .build()
            .map_err(|e| format!("capsfilter: {}", e))?;
        let jpegenc = gst::ElementFactory::make("jpegenc")
            .property("quality", 80u32)
            .build()
            .map_err(|e| format!("jpegenc: {}", e))?;
        let sink = gst::ElementFactory::make("appsink")
            .property("emit-signals", true)
            .property("max-buffers", 1u32)
            .property("drop", true)
            .build()
            .map_err(|e| format!("appsink: {}", e))?;

        let frame_buffer = FrameBuffer::new();
        let fb_clone = frame_buffer.clone();

        let appsink = sink
            .clone()
            .dynamic_cast::<gst_app::AppSink>()
            .map_err(|_| "sink is not an AppSink".to_string())?;
        appsink.set_callbacks(
            gst_app::AppSinkCallbacks::builder()
                .new_sample(move |sink| {
                    let sample = sink.pull_sample().map_err(|_| gst::FlowError::Error)?;
                    let buffer = sample.buffer().ok_or(gst::FlowError::Error)?;
                    let map = buffer.map_readable().map_err(|_| gst::FlowError::Error)?;
                    fb_clone.set(map.as_slice().to_vec());
                    Ok(gst::FlowSuccess::Ok)
                })
                .build(),
        );

        pipeline
            .add_many([&src, &convert, &scale, &capsfilter, &jpegenc, &sink])
            .map_err(|e| format!("add_many: {}", e))?;
        gst::Element::link_many([&src, &convert, &scale, &capsfilter, &jpegenc, &sink])
            .map_err(|e| format!("link_many: {}", e))?;

        let bus = pipeline.bus().ok_or("no bus")?;
        let watch_id = bus
            .add_watch(move |_, msg| {
                if let gst::MessageView::Error(err) = msg.view() {
                    log::error!("preview pipeline error: {}", err.error());
                }
                glib::ControlFlow::Continue
            })
            .map_err(|e| format!("bus add_watch: {}", e))?;

        pipeline
            .set_state(gst::State::Playing)
            .map_err(|e| format!("set_state Playing: {}", e))?;

        Ok(Self {
            pipeline,
            frame_buffer,
            bus_watch: Some(watch_id),
        })
    }

    pub fn frame_buffer(&self) -> FrameBuffer {
        self.frame_buffer.clone()
    }

    /// Stop the pipeline and release resources. Sends EOS so muxers can
    /// finalize, then sets state to NULL.
    pub fn stop(&mut self) {
        self.bus_watch = None;
        let _ = self.pipeline.send_event(gst::event::Eos::new());
        let _ = self.pipeline.set_state(gst::State::Null);
    }
}

impl Drop for PreviewPipeline {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Holds the active preview pipeline so it survives across Tauri command
/// calls. Stored in Tauri managed state.
pub struct CaptureHandle {
    pub pipeline: Mutex<Option<PreviewPipeline>>,
    /// Resolved when the portal returns a node id (or an error).
    #[allow(dead_code)]
    pub pending: Mutex<Option<oneshot::Receiver<Result<u32, String>>>>,
}

impl Default for CaptureHandle {
    fn default() -> Self {
        Self {
            pipeline: Mutex::new(None),
            pending: Mutex::new(None),
        }
    }
}
