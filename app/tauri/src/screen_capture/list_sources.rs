//! The screens and windows the operator can share, each with a small
//! thumbnail for the picker.

use super::encode_frame::{encode_jpeg, fit_within};
use super::log::{log, Level};
use super::source_id::SourceId;
use base64::Engine;
use serde::Serialize;

const THUMB_WIDTH: u32 = 320;
const THUMB_HEIGHT: u32 = 180;
/// Smaller windows are tool palettes, tray popups and the like.
const MIN_WINDOW_SIDE: u32 = 120;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSource {
    pub id: String,
    pub kind: &'static str,
    pub name: String,
    pub app_name: Option<String>,
    pub width: u32,
    pub height: u32,
    /// A `data:image/jpeg;base64,...` URL, or None when the capture failed
    /// (e.g. macOS screen-recording permission not granted yet).
    pub thumbnail: Option<String>,
}

pub fn list_sources() -> Result<Vec<CaptureSource>, String> {
    let mut sources = list_monitors()?;
    sources.extend(list_windows()?);
    Ok(sources)
}

fn list_monitors() -> Result<Vec<CaptureSource>, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("list screens: {e}"))?;
    Ok(monitors
        .iter()
        .filter_map(|m| {
            let id = m.id().ok()?;
            let name = m
                .friendly_name()
                .ok()
                .filter(|n| !n.trim().is_empty())
                .or_else(|| m.name().ok())
                .unwrap_or_default();
            Some(CaptureSource {
                id: SourceId::Monitor(id).to_string(),
                kind: "monitor",
                name,
                app_name: None,
                width: m.width().unwrap_or(0),
                height: m.height().unwrap_or(0),
                thumbnail: thumbnail(m.capture_image()),
            })
        })
        .collect())
}

fn list_windows() -> Result<Vec<CaptureSource>, String> {
    let own_pid = std::process::id();
    let windows = xcap::Window::all().map_err(|e| format!("list windows: {e}"))?;
    Ok(windows
        .iter()
        .filter(|w| is_shareable(w, own_pid))
        .filter_map(|w| {
            Some(CaptureSource {
                id: SourceId::Window(w.id().ok()?).to_string(),
                kind: "window",
                name: w.title().unwrap_or_default(),
                app_name: w.app_name().ok().filter(|n| !n.is_empty()),
                width: w.width().unwrap_or(0),
                height: w.height().unwrap_or(0),
                thumbnail: thumbnail(w.capture_image()),
            })
        })
        .collect())
}

/// A window worth offering: titled, visible, big enough, and not one of
/// Church Hub's own (sharing the projector window into itself loops).
fn is_shareable(w: &xcap::Window, own_pid: u32) -> bool {
    !w.title().unwrap_or_default().trim().is_empty()
        && !w.is_minimized().unwrap_or(true)
        && w.width().unwrap_or(0) >= MIN_WINDOW_SIDE
        && w.height().unwrap_or(0) >= MIN_WINDOW_SIDE
        && w.pid().map(|pid| pid != own_pid).unwrap_or(false)
}

fn thumbnail(capture: xcap::XCapResult<image::RgbaImage>) -> Option<String> {
    let image = capture
        .map_err(|e| log(Level::Debug, &format!("thumbnail capture failed: {e}")))
        .ok()?;
    let (w, h) = fit_within(image.width(), image.height(), THUMB_WIDTH, THUMB_HEIGHT);
    let small = image::imageops::resize(&image, w, h, image::imageops::FilterType::Triangle);
    let jpeg = encode_jpeg(&small).ok()?;
    Some(format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(jpeg)
    ))
}
