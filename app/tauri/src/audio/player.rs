use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::{mpsc, Arc, RwLock};
use std::time::{Duration, Instant};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Clone, serde::Serialize)]
pub struct AudioState {
    #[serde(rename = "isPlaying")]
    pub is_playing: bool,
    #[serde(rename = "currentTime")]
    pub current_time: f64,
    pub duration: f64,
    pub volume: f64,
    #[serde(rename = "isMuted")]
    pub is_muted: bool,
    #[serde(rename = "isLoading")]
    pub is_loading: bool,
    pub error: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
}

impl Default for AudioState {
    fn default() -> Self {
        Self {
            is_playing: false,
            current_time: 0.0,
            duration: 0.0,
            volume: 100.0,
            is_muted: false,
            is_loading: false,
            error: None,
            updated_at: timestamp_now(),
        }
    }
}

/// Shared state that can be read without blocking the audio thread
#[derive(Clone, Default)]
pub struct SharedAudioState {
    inner: Arc<RwLock<AudioState>>,
    finished: Arc<RwLock<bool>>,
}

impl SharedAudioState {
    pub fn get(&self) -> AudioState {
        self.inner.read().unwrap().clone()
    }

    pub fn is_finished(&self) -> bool {
        *self.finished.read().unwrap()
    }

    fn update(&self, state: AudioState) {
        *self.inner.write().unwrap() = state;
    }

    fn set_finished(&self, finished: bool) {
        *self.finished.write().unwrap() = finished;
    }
}

/// Commands sent to the audio player thread
pub enum AudioCommand {
    Load(String),
    Play,
    Pause,
    Stop,
    Seek(f64),
    SetVolume(f64),
    SetMuted(bool),
    MarkFinished,
    Shutdown,
}

/// Handle to send commands to the audio player
#[derive(Clone)]
pub struct AudioPlayerHandle {
    tx: mpsc::Sender<AudioCommand>,
    shared_state: SharedAudioState,
}

impl AudioPlayerHandle {
    pub fn load(&self, path: &str) {
        let _ = self.tx.send(AudioCommand::Load(path.to_string()));
    }

    pub fn play(&self) {
        let _ = self.tx.send(AudioCommand::Play);
    }

    pub fn pause(&self) {
        let _ = self.tx.send(AudioCommand::Pause);
    }

    pub fn stop(&self) {
        let _ = self.tx.send(AudioCommand::Stop);
    }

    pub fn seek(&self, position: f64) {
        let _ = self.tx.send(AudioCommand::Seek(position));
    }

    pub fn set_volume(&self, level: f64) {
        let _ = self.tx.send(AudioCommand::SetVolume(level));
    }

    pub fn set_muted(&self, muted: bool) {
        let _ = self.tx.send(AudioCommand::SetMuted(muted));
    }

    /// Get state without blocking - reads from shared state
    pub fn get_state(&self) -> AudioState {
        self.shared_state.get()
    }

    /// Check if finished without blocking
    pub fn is_finished(&self) -> bool {
        self.shared_state.is_finished()
    }

    pub fn mark_finished(&self) {
        let _ = self.tx.send(AudioCommand::MarkFinished);
    }

    pub fn shutdown(&self) {
        let _ = self.tx.send(AudioCommand::Shutdown);
    }
}

/// Create a new audio player running on its own thread
pub fn create_audio_player() -> Result<AudioPlayerHandle, String> {
    let (tx, rx) = mpsc::channel::<AudioCommand>();
    let shared_state = SharedAudioState::default();
    let shared_state_clone = shared_state.clone();

    std::thread::spawn(move || {
        run_audio_player_thread(rx, shared_state_clone);
    });

    Ok(AudioPlayerHandle { tx, shared_state })
}

fn run_audio_player_thread(rx: mpsc::Receiver<AudioCommand>, shared_state: SharedAudioState) {
    // Create audio output stream
    let (stream, stream_handle) = match OutputStream::try_default() {
        Ok((s, h)) => (s, h),
        Err(e) => {
            println!("[audio] Failed to create audio output stream: {}", e);
            return;
        }
    };

    let mut sink: Option<Sink> = None;
    let mut state = InternalState::default();

    // Keep stream alive
    let _stream = stream;

    // Helper to sync internal state to shared state
    let sync_state = |state: &mut InternalState, shared: &SharedAudioState, sink: &Option<Sink>| {
        // Update current time if playing
        if state.is_playing {
            if let Some(start) = state.start_time {
                let elapsed = start.elapsed() + state.pause_offset;
                state.current_time = elapsed.as_secs_f64();
                if state.duration > 0.0 && state.current_time > state.duration {
                    state.current_time = state.duration;
                }
            }
        }

        // Check if track finished
        let is_finished = if let Some(ref s) = sink {
            s.empty() && state.is_playing
        } else {
            false
        };
        shared.set_finished(is_finished);

        shared.update(AudioState {
            is_playing: state.is_playing,
            current_time: state.current_time,
            duration: state.duration,
            volume: state.volume,
            is_muted: state.is_muted,
            is_loading: state.is_loading,
            error: state.error.clone(),
            updated_at: timestamp_now(),
        });
    };

    loop {
        match rx.recv_timeout(Duration::from_millis(10)) {
            Ok(cmd) => match cmd {
                AudioCommand::Load(path) => {
                    load_file(&stream_handle, &mut sink, &mut state, &path);
                    sync_state(&mut state, &shared_state, &sink);
                }
                AudioCommand::Play => {
                    if let Some(ref s) = sink {
                        if s.is_paused() {
                            s.play();
                        }
                    }
                    if !state.is_playing {
                        state.is_playing = true;
                        state.start_time = Some(Instant::now());
                    }
                    sync_state(&mut state, &shared_state, &sink);
                }
                AudioCommand::Pause => {
                    // Store current position before pausing
                    if let Some(start) = state.start_time {
                        let elapsed = start.elapsed() + state.pause_offset;
                        state.pause_offset = elapsed;
                        state.current_time = elapsed.as_secs_f64();
                    }
                    state.is_playing = false;
                    state.start_time = None;

                    if let Some(ref s) = sink {
                        s.pause();
                    }
                    sync_state(&mut state, &shared_state, &sink);
                }
                AudioCommand::Stop => {
                    if let Some(ref s) = sink {
                        s.stop();
                    }
                    sink = None;
                    state.is_playing = false;
                    state.current_time = 0.0;
                    state.start_time = None;
                    state.pause_offset = Duration::ZERO;
                    state.current_path = None;
                    sync_state(&mut state, &shared_state, &sink);
                }
                AudioCommand::Seek(position) => {
                    seek_to_position(&stream_handle, &mut sink, &mut state, position, &shared_state);
                }
                AudioCommand::SetVolume(level) => {
                    let volume = (level / 100.0).clamp(0.0, 1.0) as f32;
                    if let Some(ref s) = sink {
                        if !state.is_muted {
                            s.set_volume(volume);
                        }
                    }
                    state.volume = level;
                    state.pre_mute_volume = level;
                    sync_state(&mut state, &shared_state, &sink);
                }
                AudioCommand::SetMuted(muted) => {
                    if let Some(ref s) = sink {
                        if muted {
                            s.set_volume(0.0);
                        } else {
                            s.set_volume((state.volume / 100.0) as f32);
                        }
                    }
                    state.is_muted = muted;
                    sync_state(&mut state, &shared_state, &sink);
                }
                AudioCommand::MarkFinished => {
                    state.is_playing = false;
                    state.current_time = state.duration;
                    state.start_time = None;
                    state.pause_offset = Duration::ZERO;
                    sync_state(&mut state, &shared_state, &sink);
                }
                AudioCommand::Shutdown => {
                    if let Some(ref s) = sink {
                        s.stop();
                    }
                    break;
                }
            },
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Periodically sync state even without commands (for time updates during playback)
                sync_state(&mut state, &shared_state, &sink);
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                break;
            }
        }
    }

    println!("[audio] Audio player thread shutting down");
}

fn load_file(
    stream_handle: &OutputStreamHandle,
    sink: &mut Option<Sink>,
    state: &mut InternalState,
    path: &str,
) {
    println!("[audio] Loading file: {}", path);

    state.is_loading = true;
    state.error = None;

    // Open and decode the file
    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            let err = format!("Failed to open file '{}': {}", path, e);
            state.error = Some(err);
            state.is_loading = false;
            return;
        }
    };

    let source = match Decoder::new(BufReader::new(file)) {
        Ok(s) => s,
        Err(e) => {
            let err = format!("Failed to decode audio '{}': {}", path, e);
            state.error = Some(err);
            state.is_loading = false;
            return;
        }
    };

    // Get duration - try rodio first, then probe with symphonia
    let duration = source
        .total_duration()
        .map(|d| d.as_secs_f64())
        .or_else(|| probe_duration(path))
        .unwrap_or(0.0);

    // Create a new sink for this track
    let new_sink = match Sink::try_new(stream_handle) {
        Ok(s) => s,
        Err(e) => {
            let err = format!("Failed to create audio sink: {}", e);
            state.error = Some(err);
            state.is_loading = false;
            return;
        }
    };

    // Set volume
    let volume = if state.is_muted {
        0.0
    } else {
        (state.volume / 100.0) as f32
    };
    new_sink.set_volume(volume);
    new_sink.append(source);

    // Stop old sink if any
    if let Some(old_sink) = sink.take() {
        old_sink.stop();
    }

    *sink = Some(new_sink);

    // Update state
    state.is_playing = true;
    state.current_time = 0.0;
    state.duration = duration;
    state.is_loading = false;
    state.error = None;
    state.start_time = Some(Instant::now());
    state.pause_offset = Duration::ZERO;
    state.current_path = Some(path.to_string());

    println!("[audio] Loaded successfully, duration: {:.2}s", duration);
}

fn seek_to_position(
    stream_handle: &OutputStreamHandle,
    sink: &mut Option<Sink>,
    state: &mut InternalState,
    position: f64,
    shared_state: &SharedAudioState,
) {
    let path = match &state.current_path {
        Some(p) => p.clone(),
        None => {
            println!("[audio] Cannot seek: no file loaded");
            return;
        }
    };

    // Clamp position to valid range (if duration is known)
    let position = if state.duration > 0.0 {
        position.clamp(0.0, state.duration)
    } else {
        position.max(0.0)
    };

    // IMMEDIATELY update state so UI reflects the new position
    // This happens before the potentially slow seek operation
    let was_playing = state.is_playing;
    state.current_time = position;
    state.pause_offset = Duration::from_secs_f64(position);
    if was_playing {
        state.start_time = Some(Instant::now());
    }

    // Immediately publish to shared state so UI updates instantly
    shared_state.update(AudioState {
        is_playing: state.is_playing,
        current_time: position,
        duration: state.duration,
        volume: state.volume,
        is_muted: state.is_muted,
        is_loading: state.is_loading,
        error: state.error.clone(),
        updated_at: timestamp_now(),
    });

    println!("[audio] Seeking to position: {:.2}s", position);

    // Open and decode the file
    let file = match File::open(&path) {
        Ok(f) => f,
        Err(e) => {
            println!("[audio] Seek failed - cannot open file: {}", e);
            return;
        }
    };

    let source = match Decoder::new(BufReader::new(file)) {
        Ok(s) => s,
        Err(e) => {
            println!("[audio] Seek failed - cannot decode: {}", e);
            return;
        }
    };

    // Skip to the desired position
    let skip_duration = Duration::from_secs_f64(position);
    let source = source.skip_duration(skip_duration);

    // Create a new sink
    let new_sink = match Sink::try_new(stream_handle) {
        Ok(s) => s,
        Err(e) => {
            println!("[audio] Seek failed - cannot create sink: {}", e);
            return;
        }
    };

    // Set volume
    let volume = if state.is_muted {
        0.0
    } else {
        (state.volume / 100.0) as f32
    };
    new_sink.set_volume(volume);
    new_sink.append(source);

    // Keep playing state - don't pause if we were playing
    if !was_playing {
        new_sink.pause();
    }

    // Stop old sink AFTER new one is ready to minimize gap
    if let Some(old_sink) = sink.take() {
        old_sink.stop();
    }

    *sink = Some(new_sink);

    println!("[audio] Seeked to {:.2}s successfully", position);
}

struct InternalState {
    is_playing: bool,
    current_time: f64,
    duration: f64,
    volume: f64,
    is_muted: bool,
    is_loading: bool,
    error: Option<String>,
    start_time: Option<Instant>,
    pause_offset: Duration,
    pre_mute_volume: f64,
    current_path: Option<String>,
}

impl Default for InternalState {
    fn default() -> Self {
        Self {
            is_playing: false,
            current_time: 0.0,
            duration: 0.0,
            volume: 100.0,
            is_muted: false,
            is_loading: false,
            error: None,
            start_time: None,
            pause_offset: Duration::ZERO,
            pre_mute_volume: 100.0,
            current_path: None,
        }
    }
}

fn timestamp_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Probe audio file for duration using symphonia
fn probe_duration(path: &str) -> Option<f64> {
    let file = File::open(path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Create a hint based on file extension
    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path).extension() {
        hint.with_extension(ext.to_str().unwrap_or(""));
    }

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .ok()?;

    let format = probed.format;

    // Get the default track
    let track = format.default_track()?;

    // Calculate duration from codec params
    let time_base = track.codec_params.time_base?;
    let n_frames = track.codec_params.n_frames?;

    let duration_secs = time_base.calc_time(n_frames).seconds as f64
        + (time_base.calc_time(n_frames).frac as f64);

    Some(duration_secs)
}
