//! The screens and windows the operator can share, each with a small
//! thumbnail for the picker.

use super::encode_frame::{encode_jpeg, fit_within};
use super::log::{log, Level};
use super::source_id::SourceId;
use base64::Engine;
use serde::Serialize;
use std::sync::mpsc;
use std::time::{Duration, Instant};

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

/// How long the picker waits for the thumbnails. A hung app's window can
/// block its capture forever; it is then listed without one.
const THUMBNAILS_DEADLINE: Duration = Duration::from_secs(4);

/// Captures one source (a screen or window handle it owns).
type Grab = Box<dyn Fn() -> xcap::XCapResult<image::RgbaImage>>;

/// What the worker thread sends: first every source, then each thumbnail.
enum Found {
    Sources(Vec<CaptureSource>),
    Thumbnail(String, String),
}

pub fn list_sources() -> Result<Vec<CaptureSource>, String> {
    let (tx, rx) = mpsc::channel();
    // xcap's handles are not Send, so the worker enumerates them itself; a
    // capture that never returns only keeps that thread, never the picker.
    std::thread::Builder::new()
        .name("screen-capture-sources".into())
        .spawn(move || find_sources(&tx))
        .map_err(|e| format!("spawn sources thread: {e}"))?;

    let mut sources = match rx.recv() {
        Ok(Ok(Found::Sources(sources))) => sources,
        Ok(Err(e)) => return Err(e),
        _ => return Err("the sources thread ended early".into()),
    };
    let deadline = Instant::now() + THUMBNAILS_DEADLINE;
    while let Some(left) = deadline.checked_duration_since(Instant::now()) {
        match rx.recv_timeout(left) {
            Ok(Ok(Found::Thumbnail(id, url))) => {
                if let Some(source) = sources.iter_mut().find(|s| s.id == id) {
                    source.thumbnail = Some(url);
                }
            }
            Ok(_) => {}
            Err(mpsc::RecvTimeoutError::Timeout) => {
                log(
                    Level::Warning,
                    "some thumbnails took too long; listed without them",
                );
                break;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    Ok(sources)
}

fn find_sources(tx: &mpsc::Sender<Result<Found, String>>) {
    let found = (|| -> Result<_, String> {
        let monitors = xcap::Monitor::all().map_err(|e| format!("list screens: {e}"))?;
        let own_pid = std::process::id();
        let windows: Vec<_> = xcap::Window::all()
            .map_err(|e| format!("list windows: {e}"))?
            .into_iter()
            .filter(|w| is_shareable(w, own_pid))
            .collect();
        Ok((monitors, windows))
    })();
    let (monitors, windows) = match found {
        Ok(found) => found,
        Err(e) => {
            let _ = tx.send(Err(e));
            return;
        }
    };
    let mut targets: Vec<(String, Grab)> = Vec::new();
    let mut sources = Vec::new();
    for m in monitors {
        let Ok(id) = m.id() else { continue };
        let id = SourceId::Monitor(id).to_string();
        sources.push(CaptureSource {
            id: id.clone(),
            kind: "monitor",
            name: m
                .friendly_name()
                .ok()
                .filter(|n| !n.trim().is_empty())
                .or_else(|| m.name().ok())
                .unwrap_or_default(),
            app_name: None,
            width: m.width().unwrap_or(0),
            height: m.height().unwrap_or(0),
            thumbnail: None,
        });
        targets.push((id, Box::new(move || m.capture_image())));
    }
    for w in windows {
        let Ok(id) = w.id() else { continue };
        let id = SourceId::Window(id).to_string();
        sources.push(CaptureSource {
            id: id.clone(),
            kind: "window",
            name: w.title().unwrap_or_default(),
            app_name: w.app_name().ok().filter(|n| !n.is_empty()),
            width: w.width().unwrap_or(0),
            height: w.height().unwrap_or(0),
            thumbnail: None,
        });
        targets.push((id, Box::new(move || w.capture_image())));
    }
    if tx.send(Ok(Found::Sources(sources))).is_err() {
        return;
    }
    for (id, capture) in targets {
        log(Level::Trace, &format!("thumbnail of {id}"));
        if let Some(url) = thumbnail(capture()) {
            if tx.send(Ok(Found::Thumbnail(id, url))).is_err() {
                return; // The picker stopped waiting.
            }
        }
    }
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
    // thumbnail() is a fast area average: a picker shows dozens of these.
    let small = image::imageops::thumbnail(&image, w, h);
    let jpeg = encode_jpeg(&small).ok()?;
    Some(format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(jpeg)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Needs a desktop session: `cargo test -- --ignored` on a machine with a
    /// screen (CI runners have none).
    #[test]
    #[ignore]
    fn lists_and_thumbnails_this_machines_screens() {
        let sources = list_sources().unwrap();
        let screens: Vec<_> = sources.iter().filter(|s| s.kind == "monitor").collect();
        assert!(!screens.is_empty(), "no screen found");
        for screen in &screens {
            assert!(screen.id.parse::<SourceId>().is_ok());
            assert!(screen.width > 0 && screen.height > 0);
            let thumb = screen.thumbnail.as_deref().expect("screen thumbnail");
            assert!(thumb.starts_with("data:image/jpeg;base64,"));
        }
        println!(
            "{} screens, {} windows",
            screens.len(),
            sources.len() - screens.len()
        );
    }
}
