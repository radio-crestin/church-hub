//! The capture thread: grabs the chosen screen or window at the chosen rate,
//! scales and encodes each frame, and publishes it to the hub.

use super::encode_frame::{encode_frame, MAX_HEIGHT, MAX_WIDTH};
use super::frame_hub::FrameHub;
use super::log::{log, Level};
use super::source_id::SourceId;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub const MIN_FPS: u32 = 1;
pub const MAX_FPS: u32 = 30;
/// Consecutive failed grabs after which the source counts as gone (the
/// window was closed, the screen unplugged).
const MAX_FAILURES: u32 = 30;

enum Target {
    Monitor(xcap::Monitor),
    Window(xcap::Window),
}

impl Target {
    fn find(source: SourceId) -> Result<Target, String> {
        match source {
            SourceId::Monitor(id) => xcap::Monitor::all()
                .map_err(|e| format!("list screens: {e}"))?
                .into_iter()
                .find(|m| m.id().ok() == Some(id))
                .map(Target::Monitor),
            SourceId::Window(id) => xcap::Window::all()
                .map_err(|e| format!("list windows: {e}"))?
                .into_iter()
                .find(|w| w.id().ok() == Some(id))
                .map(Target::Window),
        }
        .ok_or_else(|| format!("source {source} is no longer available"))
    }

    fn capture(&self) -> Result<image::RgbaImage, String> {
        match self {
            Target::Monitor(m) => m.capture_image(),
            Target::Window(w) => w.capture_image(),
        }
        .map_err(|e| e.to_string())
    }
}

pub struct CaptureLoop {
    stop: Arc<AtomicBool>,
    hub: Arc<FrameHub>,
}

impl CaptureLoop {
    /// Starts capturing `source`; `on_end` runs on the capture thread if the
    /// source goes away (not when `stop` is called).
    pub fn start(
        source: SourceId,
        fps: u32,
        hub: Arc<FrameHub>,
        on_end: impl FnOnce(String) + Send + 'static,
    ) -> Result<CaptureLoop, String> {
        let interval = Duration::from_secs_f64(1.0 / fps.clamp(MIN_FPS, MAX_FPS) as f64);
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = stop.clone();
        let thread_hub = hub.clone();
        // xcap's handles are not Send (Windows HWNDs): the source is found on
        // the capture thread, which reports back whether it could grab it, so
        // a bad source fails in the operator's face rather than silently.
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        std::thread::Builder::new()
            .name("screen-capture".into())
            .spawn(move || {
                let target = match Target::find(source).and_then(|t| t.capture().map(|_| t)) {
                    Ok(target) => {
                        let _ = ready_tx.send(Ok(()));
                        target
                    }
                    Err(e) => {
                        let _ = ready_tx.send(Err(e));
                        return;
                    }
                };
                run(target, interval, &thread_hub, &thread_stop, on_end)
            })
            .map_err(|e| format!("spawn capture thread: {e}"))?;
        ready_rx
            .recv()
            .map_err(|_| "the capture thread ended before starting".to_string())??;
        log(Level::Info, &format!("capturing {source} at {fps} fps"));
        Ok(CaptureLoop { stop, hub })
    }

    /// Stops at once, without waiting for the thread: a hung app's window
    /// can block a grab forever. The thread ends after its current grab and
    /// publishes nothing more.
    pub fn stop(self) {
        self.stop.store(true, Ordering::SeqCst);
        self.hub.clear();
    }
}

fn run(
    target: Target,
    interval: Duration,
    hub: &FrameHub,
    stop: &AtomicBool,
    on_end: impl FnOnce(String),
) {
    let mut failures = 0;
    while !stop.load(Ordering::SeqCst) {
        let started = Instant::now();
        let grabbed = target
            .capture()
            .and_then(|image| encode_frame(image, MAX_WIDTH, MAX_HEIGHT));
        // Stopped during the grab: the hub may already serve the next share.
        if stop.load(Ordering::SeqCst) {
            return;
        }
        match grabbed {
            Ok(frame) => {
                failures = 0;
                hub.publish(frame.width, frame.height, frame.rgba, frame.jpeg);
            }
            Err(e) => {
                failures += 1;
                log(Level::Debug, &format!("grab failed ({failures}): {e}"));
                if failures >= MAX_FAILURES {
                    log(Level::Warning, &format!("source lost: {e}"));
                    hub.clear();
                    on_end(e);
                    return;
                }
            }
        }
        if let Some(rest) = interval.checked_sub(started.elapsed()) {
            std::thread::sleep(rest);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Needs a desktop session: `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn captures_the_first_screen_into_the_hub() {
        let monitor = xcap::Monitor::all().unwrap().remove(0);
        let source = SourceId::Monitor(monitor.id().unwrap());
        let hub = Arc::new(FrameHub::default());
        let capture = CaptureLoop::start(source, 10, hub.clone(), |_| {}).unwrap();
        let frame = hub.wait_newer(0, Duration::from_secs(5)).expect("a frame");
        assert!(frame.width <= MAX_WIDTH && frame.height <= MAX_HEIGHT);
        assert_eq!(frame.rgba.len(), (frame.width * frame.height * 4) as usize);
        assert_eq!(&frame.jpeg[..2], &[0xFF, 0xD8]);
        let next = hub
            .wait_newer(frame.seq, Duration::from_secs(5))
            .expect("a second frame");
        assert!(next.seq > frame.seq);
        capture.stop();
        assert!(hub.latest().is_none(), "stop clears the hub");
    }

    #[test]
    fn an_unknown_source_fails_at_start() {
        let hub = Arc::new(FrameHub::default());
        let result = CaptureLoop::start(SourceId::Window(u32::MAX), 10, hub, |_| {});
        assert!(result.is_err());
    }
}
