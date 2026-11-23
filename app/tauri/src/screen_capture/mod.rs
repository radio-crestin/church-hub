//! Native screen sharing: capture a screen or window (xcap), draw it on the
//! projector windows with the GPU, and send it to the sidecar for the
//! browser screens.

pub mod capture_loop;
pub mod commands;
pub mod encode_frame;
pub mod frame_hub;
pub mod frame_publisher;
pub mod gpu;
pub mod list_sources;
pub mod log;
pub mod source_id;

use capture_loop::CaptureLoop;
use frame_hub::FrameHub;
use frame_publisher::FramePublisher;
use gpu::share_surface::ShareSurfaces;
use parking_lot::Mutex;
use std::sync::Arc;
use tauri::Runtime;

/// The running capture: its thread and the one sending its frames out.
pub struct CaptureSession {
    capture: CaptureLoop,
    publisher: FramePublisher,
}

impl CaptureSession {
    fn stop(self) {
        self.capture.stop();
        self.publisher.stop();
    }
}

pub struct ScreenCapture<R: Runtime> {
    pub hub: Arc<FrameHub>,
    pub session: Mutex<Option<CaptureSession>>,
    pub surfaces: ShareSurfaces<R>,
}

impl<R: Runtime> Default for ScreenCapture<R> {
    fn default() -> Self {
        ScreenCapture {
            hub: Arc::new(FrameHub::default()),
            session: Mutex::new(None),
            surfaces: ShareSurfaces::default(),
        }
    }
}
