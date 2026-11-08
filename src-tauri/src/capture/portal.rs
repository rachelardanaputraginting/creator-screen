use ashpd::desktop::screencast::{
    CursorMode, Screencast, SelectSourcesOptions, SourceType, Stream,
};
use ashpd::desktop::PersistMode;
use std::os::fd::OwnedFd;

/// Result of starting a screen cast session via the xdg-desktop-portal.
/// The `node_id` is passed to GStreamer `pipewiresrc path=<node_id>`.
/// The `fd` is the PipeWire remote file descriptor.
pub struct ScreenCastSession {
    pub node_id: u32,
    pub _fd: OwnedFd,
    pub _streams: Vec<Stream>,
}

/// Start a screen cast session through the portal. On Wayland the compositor
/// (GNOME/KDE/wlroots) shows its native source picker. On X11 this portal may
/// not be available — the caller should fall back to `ximagesrc`.
///
/// Mirrors the flow from `electron/capture.js`: the portal dialog has already
/// chosen what to share, so a single returned source is used directly.
pub async fn start_screencast() -> Result<ScreenCastSession, String> {
    let proxy = Screencast::new().await.map_err(|e| e.to_string())?;
    let session = proxy
        .create_session(Default::default())
        .await
        .map_err(|e| e.to_string())?;

    proxy
        .select_sources(
            &session,
            SelectSourcesOptions::default()
                .set_cursor_mode(CursorMode::METADATA)
                .set_sources(SourceType::MONITOR | SourceType::WINDOW)
                .set_multiple(false)
                .set_persist_mode(PersistMode::DoNot),
        )
        .await
        .map_err(|e| e.to_string())?;

    let response = proxy
        .start(&session, None, Default::default())
        .await
        .map_err(|e| e.to_string())?
        .response()
        .map_err(|e| e.to_string())?;

    let streams: Vec<Stream> = response.streams().to_vec();
    let stream = streams
        .first()
        .ok_or_else(|| "No streams returned from screencast portal".to_string())?;

    let node_id = stream.pipe_wire_node_id();
    let fd = proxy
        .open_pipe_wire_remote(&session, Default::default())
        .await
        .map_err(|e| e.to_string())?;

    Ok(ScreenCastSession {
        node_id,
        _fd: fd,
        _streams: streams,
    })
}
