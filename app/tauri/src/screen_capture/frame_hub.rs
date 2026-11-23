//! The latest captured frame, shared by every consumer (the GPU surfaces and
//! the sidecar publisher). Only the newest frame is kept: a slow consumer
//! skips frames instead of building a backlog.

use parking_lot::{Condvar, Mutex};
use std::sync::Arc;
use std::time::Duration;

/// One captured frame, already scaled: RGBA for the GPU, JPEG for the
/// browser screens.
#[derive(Debug)]
pub struct Frame {
    pub seq: u64,
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
    pub jpeg: Vec<u8>,
}

#[derive(Default)]
pub struct FrameHub {
    latest: Mutex<Option<Arc<Frame>>>,
    next_seq: Mutex<u64>,
    changed: Condvar,
}

impl FrameHub {
    /// Stores a frame as the latest (giving it the next sequence number) and
    /// wakes every waiting consumer.
    pub fn publish(&self, width: u32, height: u32, rgba: Vec<u8>, jpeg: Vec<u8>) -> u64 {
        let seq = {
            let mut next = self.next_seq.lock();
            *next += 1;
            *next
        };
        let frame = Arc::new(Frame {
            seq,
            width,
            height,
            rgba,
            jpeg,
        });
        *self.latest.lock() = Some(frame);
        self.changed.notify_all();
        seq
    }

    /// Drops the latest frame (the share stopped) and wakes the consumers.
    pub fn clear(&self) {
        *self.latest.lock() = None;
        self.changed.notify_all();
    }

    pub fn latest(&self) -> Option<Arc<Frame>> {
        self.latest.lock().clone()
    }

    /// The latest frame if it is newer than `after_seq`, waiting up to
    /// `timeout` for one; None on timeout or when the hub is cleared.
    pub fn wait_newer(&self, after_seq: u64, timeout: Duration) -> Option<Arc<Frame>> {
        let mut latest = self.latest.lock();
        loop {
            if let Some(frame) = latest.as_ref().filter(|f| f.seq > after_seq) {
                return Some(frame.clone());
            }
            if self.changed.wait_for(&mut latest, timeout).timed_out() {
                return None;
            }
            if latest.is_none() {
                return None;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn keeps_only_the_latest_frame() {
        let hub = FrameHub::default();
        assert!(hub.latest().is_none());
        hub.publish(1, 1, vec![1], vec![]);
        let seq = hub.publish(1, 1, vec![2], vec![]);
        let latest = hub.latest().unwrap();
        assert_eq!(latest.seq, seq);
        assert_eq!(latest.rgba, vec![2]);
    }

    #[test]
    fn wait_newer_returns_at_once_when_a_newer_frame_exists() {
        let hub = FrameHub::default();
        hub.publish(1, 1, vec![], vec![]);
        let frame = hub.wait_newer(0, Duration::from_secs(5)).unwrap();
        assert_eq!(frame.seq, 1);
    }

    #[test]
    fn wait_newer_times_out_without_a_new_frame() {
        let hub = FrameHub::default();
        let seq = hub.publish(1, 1, vec![], vec![]);
        assert!(hub.wait_newer(seq, Duration::from_millis(20)).is_none());
    }

    #[test]
    fn wait_newer_wakes_on_publish_from_another_thread() {
        let hub = Arc::new(FrameHub::default());
        let producer = hub.clone();
        let handle = thread::spawn(move || {
            thread::sleep(Duration::from_millis(30));
            producer.publish(2, 2, vec![], vec![]);
        });
        let frame = hub.wait_newer(0, Duration::from_secs(5)).unwrap();
        assert_eq!((frame.width, frame.height), (2, 2));
        handle.join().unwrap();
    }

    #[test]
    fn clear_drops_the_frame_and_releases_waiters() {
        let hub = Arc::new(FrameHub::default());
        let seq = hub.publish(1, 1, vec![], vec![]);
        let clearer = hub.clone();
        let handle = thread::spawn(move || {
            thread::sleep(Duration::from_millis(30));
            clearer.clear();
        });
        assert!(hub.wait_newer(seq, Duration::from_secs(5)).is_none());
        assert!(hub.latest().is_none());
        handle.join().unwrap();
    }
}
