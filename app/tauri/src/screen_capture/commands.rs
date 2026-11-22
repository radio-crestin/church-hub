//! The screen-capture commands the operator UI and the projector pages call.

use super::capture_loop::{CaptureLoop, MAX_FPS, MIN_FPS};
use super::frame_publisher::FramePublisher;
use super::gpu::fit_quad::ObjectFit;
use super::gpu::share_surface::SurfaceRect;
use super::list_sources::{list_sources, CaptureSource};
use super::log::{log, Level};
use super::source_id::SourceId;
use super::{CaptureSession, ScreenCapture};
use crate::domain::AppState;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Window};

/// Emitted when the shared window or screen goes away on its own.
pub const CAPTURE_ENDED_EVENT: &str = "screen-capture-ended";

#[tauri::command]
pub async fn screen_capture_sources() -> Result<Vec<CaptureSource>, String> {
    tauri::async_runtime::spawn_blocking(list_sources)
        .await
        .map_err(|e| e.to_string())?
}

/// Starts capturing `source_id` (replacing any running capture) and sending
/// its frames to the sidecar with the ingest `token` from
/// POST /api/screen-share/start.
#[tauri::command]
pub async fn screen_capture_start<R: Runtime>(
    app: AppHandle<R>,
    source_id: String,
    fps: Option<u32>,
    token: String,
) -> Result<(), String> {
    let source: SourceId = source_id.parse()?;
    let fps = fps.unwrap_or(15).clamp(MIN_FPS, MAX_FPS);
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<ScreenCapture<R>>();
        let server_port = app.state::<AppState>().server_port;
        if let Some(previous) = state.session.lock().take() {
            previous.stop();
        }
        let ended_app = app.clone();
        let capture = CaptureLoop::start(source, fps, state.hub.clone(), move |reason| {
            let _ = ended_app.emit(CAPTURE_ENDED_EVENT, reason);
        })?;
        let publisher = FramePublisher::start(state.hub.clone(), server_port, token)?;
        *state.session.lock() = Some(CaptureSession { capture, publisher });
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn screen_capture_stop<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<ScreenCapture<R>>();
        if let Some(session) = state.session.lock().take() {
            session.stop();
            log(Level::Info, "capture stopped");
        }
        state.surfaces.hide_all();
    })
    .await
    .map_err(|e| e.to_string())
}

/// Called by a projector page showing the share: draws it with the GPU over
/// `rect`. false when it can't (no capture in this app, no GPU): the page
/// shows the stream itself.
#[tauri::command]
pub async fn screen_share_surface_show<R: Runtime>(
    window: Window<R>,
    state: State<'_, ScreenCapture<R>>,
    rect: SurfaceRect,
    object_fit: ObjectFit,
) -> Result<bool, String> {
    if state.session.lock().is_none() {
        return Ok(false);
    }
    state.surfaces.show(&window, rect, object_fit, state.hub.clone())
}

#[tauri::command]
pub async fn screen_share_surface_hide<R: Runtime>(
    window: Window<R>,
    state: State<'_, ScreenCapture<R>>,
) -> Result<(), String> {
    state.surfaces.hide(window.label());
    Ok(())
}
