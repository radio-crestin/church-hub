//! Sends each new frame to the sidecar (POST /api/screen-share/frame), which
//! relays it to the browser screens as an MJPEG stream.

use super::frame_hub::FrameHub;
use super::log::{log, Level};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

const WAIT_STEP: Duration = Duration::from_millis(250);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

pub struct FramePublisher {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl FramePublisher {
    /// `token` is the ingest token the sidecar handed out on
    /// POST /api/screen-share/start.
    pub fn start(
        hub: Arc<FrameHub>,
        server_port: u16,
        token: String,
    ) -> Result<FramePublisher, String> {
        let url = format!("http://127.0.0.1:{server_port}/api/screen-share/frame");
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = stop.clone();
        let handle = std::thread::Builder::new()
            .name("screen-capture-publish".into())
            .spawn(move || run(&hub, &url, &token, &thread_stop))
            .map_err(|e| format!("spawn publisher thread: {e}"))?;
        Ok(FramePublisher {
            stop,
            handle: Some(handle),
        })
    }

    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

fn run(hub: &FrameHub, url: &str, token: &str, stop: &AtomicBool) {
    let agent = ureq::AgentBuilder::new().timeout(REQUEST_TIMEOUT).build();
    let mut last_seq = 0;
    while !stop.load(Ordering::SeqCst) {
        let Some(frame) = hub.wait_newer(last_seq, WAIT_STEP) else {
            continue;
        };
        last_seq = frame.seq;
        let sent = agent
            .post(url)
            .set("Content-Type", "image/jpeg")
            .set("X-Screen-Share-Token", token)
            .send_bytes(&frame.jpeg);
        match sent {
            Ok(_) => log(Level::Trace, &format!("frame {} sent", frame.seq)),
            Err(e) => log(Level::Debug, &format!("frame {} not sent: {e}", frame.seq)),
        }
    }
}
