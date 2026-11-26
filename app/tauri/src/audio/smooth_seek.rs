//! A source that seeks without a click or a burst of stale sound: it fades the
//! old position out, jumps a little before the target and decodes up to it so
//! the codec's state (MP3 bit reservoir, MDCT overlap) is rebuilt, then fades
//! the new position in.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use rodio::source::SeekError;
use rodio::{ChannelCount, Sample, SampleRate, Source};

/// Long enough to hide the cut, short enough to go unnoticed.
pub const FADE: Duration = Duration::from_millis(10);
/// Decoded before the target and dropped. MP3 needs up to two frames (~52 ms
/// at 44.1 kHz) before the target to decode it exactly.
const PREROLL: Duration = Duration::from_millis(60);

#[derive(Clone, Copy)]
enum Phase {
    Playing,
    FadingOut { target: Duration },
    FadingIn,
}

pub struct SmoothSeek<S> {
    inner: S,
    /// Set while the sink is paused: nothing plays, so a seek jumps at once.
    paused: Arc<AtomicBool>,
    phase: Phase,
    fade_frames: usize,
    /// Frames played of the current fade.
    frame: usize,
    /// Channel of the next sample within its frame.
    channel: usize,
}

pub fn frames_in(duration: Duration, sample_rate: SampleRate) -> usize {
    (duration.as_secs_f64() * f64::from(sample_rate)).round() as usize
}

impl<S: Source> SmoothSeek<S> {
    pub fn new(inner: S, paused: Arc<AtomicBool>) -> Self {
        let fade_frames = frames_in(FADE, inner.sample_rate()).max(1);
        Self {
            inner,
            paused,
            phase: Phase::Playing,
            fade_frames,
            frame: 0,
            channel: 0,
        }
    }

    fn start(&mut self, phase: Phase, frame: usize) {
        self.phase = phase;
        self.frame = frame;
    }

    fn jump(&mut self, target: Duration) {
        let preroll = PREROLL.min(target);
        if let Err(e) = self.inner.try_seek(target - preroll) {
            eprintln!("[audio] Seek failed: {e}");
        }
        let samples = frames_in(preroll, self.inner.sample_rate()) * self.inner.channels() as usize;
        self.inner.by_ref().take(samples).for_each(drop);
        self.start(Phase::FadingIn, 0);
    }

    fn gain(&self) -> f32 {
        let progress = self.frame as f32 / self.fade_frames as f32;
        match self.phase {
            Phase::Playing => 1.0,
            Phase::FadingOut { .. } => 1.0 - progress,
            Phase::FadingIn => progress,
        }
    }

    /// Moves on one sample; a fade steps once per frame, so channels stay level.
    fn advance(&mut self) {
        self.channel += 1;
        if self.channel < self.inner.channels() as usize {
            return;
        }
        self.channel = 0;
        if matches!(self.phase, Phase::Playing) {
            return;
        }
        self.frame += 1;
        if self.frame < self.fade_frames {
            return;
        }
        match self.phase {
            Phase::FadingOut { target } => self.jump(target),
            Phase::FadingIn => self.start(Phase::Playing, 0),
            Phase::Playing => {}
        }
    }
}

impl<S: Source> Iterator for SmoothSeek<S> {
    type Item = Sample;

    fn next(&mut self) -> Option<Sample> {
        let sample = self.inner.next()? * self.gain();
        self.advance();
        Some(sample)
    }
}

impl<S: Source> Source for SmoothSeek<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.inner.current_span_len()
    }

    fn channels(&self) -> ChannelCount {
        self.inner.channels()
    }

    fn sample_rate(&self) -> SampleRate {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }

    /// Starts the fade out and jumps when it ends. A seek that comes during a
    /// fade picks the gain up where it is, so the level never steps.
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        if self.paused.load(Ordering::SeqCst) {
            self.jump(pos);
            return Ok(());
        }
        let frame = match self.phase {
            Phase::Playing => 0,
            Phase::FadingOut { .. } => self.frame,
            Phase::FadingIn => self.fade_frames - self.frame,
        };
        self.start(Phase::FadingOut { target: pos }, frame);
        Ok(())
    }
}

/// Guards what no e2e reaches: the samples the desktop app plays around a seek.
#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::io::BufReader;

    use rodio::Decoder;

    use super::*;

    /// Two chirps, one per channel: every position sounds different.
    const FIXTURE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/seek-chirp.mp3");
    const AFTER_FADE: usize = 8192;
    /// -40 dB under the chirp's level: inaudible. Before this source (rodio 0.20) the first
    /// frame after a seek was off by up to 1.0, a burst of the wrong sound.
    const SAME_SOUND: f32 = 5e-3;

    fn open() -> Decoder<BufReader<File>> {
        Decoder::try_from(File::open(FIXTURE).unwrap()).unwrap()
    }

    struct Seek {
        reference: Vec<f32>,
        source: SmoothSeek<Decoder<BufReader<File>>>,
        channels: usize,
        fade: usize,
    }

    fn start(paused: bool) -> Seek {
        let source = SmoothSeek::new(open(), Arc::new(AtomicBool::new(paused)));
        let channels = source.channels() as usize;
        let fade = frames_in(FADE, source.sample_rate());
        Seek {
            reference: open().collect(),
            source,
            channels,
            fade,
        }
    }

    impl Seek {
        fn play(&mut self, duration: Duration) -> Vec<f32> {
            let samples = frames_in(duration, self.source.sample_rate()) * self.channels;
            self.source.by_ref().take(samples).collect()
        }

        fn take(&mut self, frames: usize) -> Vec<f32> {
            self.source.by_ref().take(frames * self.channels).collect()
        }

        fn sample_index(&self, at: Duration) -> usize {
            frames_in(at, self.source.sample_rate()) * self.channels
        }

        /// Largest difference from the reference starting at `start`, each frame scaled by `gain`.
        fn error(&self, played: &[f32], start: usize, gain: impl Fn(usize) -> f32) -> f32 {
            played
                .iter()
                .enumerate()
                .map(|(i, s)| (s - self.reference[start + i] * gain(i / self.channels)).abs())
                .fold(0.0, f32::max)
        }

        /// Where `played` (a fade in then full level) starts in the reference: within a frame
        /// of `target`, with the exact samples the track has there.
        fn assert_lands_on(&self, played: &[f32], target: Duration) {
            let nominal = self.sample_index(target) as i64;
            let fade = self.fade;
            let landing = (-2..=2)
                .map(|frames| nominal + frames * self.channels as i64)
                .map(|start| {
                    let gain = |frame: usize| (frame as f32 / fade as f32).min(1.0);
                    (start, self.error(played, start as usize, gain))
                })
                .min_by(|a, b| a.1.total_cmp(&b.1))
                .unwrap();
            assert!(
                landing.1 < SAME_SOUND,
                "after the seek it plays other sound (max error {})",
                landing.1
            );
            assert!(
                (landing.0 - nominal).abs() <= self.channels as i64,
                "lands off target"
            );
        }
    }

    /// The largest jump from one frame to the next, on any channel.
    fn max_step(samples: &[f32], channels: usize) -> f32 {
        let frames: Vec<&[f32]> = samples.chunks(channels).collect();
        frames
            .windows(2)
            .flat_map(|pair| pair[0].iter().zip(pair[1]).map(|(a, b)| (b - a).abs()))
            .fold(0.0, f32::max)
    }

    fn assert_no_click(seek: &Seek, around_cut: &[f32]) {
        let natural = max_step(&seek.reference, seek.channels);
        let step = max_step(around_cut, seek.channels);
        assert!(
            step <= natural * 1.2,
            "a jump of {step} at the seek (the track's own largest is {natural})"
        );
    }

    fn seek_while_playing(from: Duration, to: Duration) {
        let mut seek = start(false);
        let played = seek.play(from);
        seek.source.try_seek(to).unwrap();
        let fade_out = seek.take(seek.fade);
        let fade_in = seek.take(seek.fade + AFTER_FADE);

        let fade = seek.fade as f32;
        let out_error = seek.error(&fade_out, played.len(), |frame| 1.0 - frame as f32 / fade);
        assert!(
            out_error < SAME_SOUND,
            "the old position does not fade out (max error {out_error})"
        );
        seek.assert_lands_on(&fade_in, to);
        let tail = &played[played.len() - seek.channels..];
        assert_no_click(&seek, &[tail, &fade_out, &fade_in].concat());
    }

    #[test]
    fn a_seek_back_fades_out_and_plays_the_exact_new_position() {
        seek_while_playing(Duration::from_millis(1500), Duration::from_millis(400));
    }

    #[test]
    fn a_seek_forward_fades_out_and_plays_the_exact_new_position() {
        seek_while_playing(Duration::from_millis(500), Duration::from_millis(1800));
    }

    #[test]
    fn seeks_during_a_fade_keep_the_level_smooth_and_land_on_the_last() {
        let mut seek = start(false);
        let played = seek.play(Duration::from_millis(1000));
        seek.source.try_seek(Duration::from_millis(300)).unwrap();
        let first = seek.take(seek.fade / 2);
        seek.source.try_seek(Duration::from_millis(1700)).unwrap();
        let second = seek.take(seek.fade / 2);
        let fade_in = seek.take(seek.fade + AFTER_FADE);

        seek.assert_lands_on(&fade_in, Duration::from_millis(1700));
        let tail = &played[played.len() - seek.channels..];
        assert_no_click(&seek, &[tail, &first, &second, &fade_in].concat());
    }

    #[test]
    fn a_seek_while_paused_starts_the_new_position_faded_in() {
        let mut seek = start(true);
        seek.play(Duration::from_millis(800));
        seek.source.try_seek(Duration::from_millis(2000)).unwrap();
        let resumed = seek.take(seek.fade + AFTER_FADE);
        seek.assert_lands_on(&resumed, Duration::from_millis(2000));
    }
}
