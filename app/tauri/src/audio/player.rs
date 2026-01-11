use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc;
use std::time::{Duration, Instant};

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

/// Commands sent to the audio player thread
pub enum AudioCommand {
    Load(String),
    Play,
    Pause,
    Stop,
    Seek(f64),
    SetVolume(f64),
    SetMuted(bool),
    GetState(mpsc::Sender<AudioState>),
    IsFinished(mpsc::Sender<bool>),
    MarkFinished,
    Shutdown,
}

/// Handle to send commands to the audio player
#[derive(Clone)]
pub struct AudioPlayerHandle {
    tx: mpsc::Sender<AudioCommand>,
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

    pub fn get_state(&self) -> AudioState {
        let (tx, rx) = mpsc::channel();
        if self.tx.send(AudioCommand::GetState(tx)).is_ok() {
            rx.recv_timeout(Duration::from_millis(100))
                .unwrap_or_default()
        } else {
            AudioState::default()
        }
    }

    pub fn is_finished(&self) -> bool {
        let (tx, rx) = mpsc::channel();
        if self.tx.send(AudioCommand::IsFinished(tx)).is_ok() {
            rx.recv_timeout(Duration::from_millis(100)).unwrap_or(false)
        } else {
            false
        }
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

    std::thread::spawn(move || {
        run_audio_player_thread(rx);
    });

    Ok(AudioPlayerHandle { tx })
}

fn run_audio_player_thread(rx: mpsc::Receiver<AudioCommand>) {
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

    loop {
        match rx.recv_timeout(Duration::from_millis(10)) {
            Ok(cmd) => match cmd {
                AudioCommand::Load(path) => {
                    load_file(&stream_handle, &mut sink, &mut state, &path);
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
                }
                AudioCommand::Seek(position) => {
                    state.current_time = position;
                    state.pause_offset = Duration::from_secs_f64(position);
                    if state.is_playing {
                        state.start_time = Some(Instant::now());
                    }
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
                }
                AudioCommand::GetState(reply) => {
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

                    let audio_state = AudioState {
                        is_playing: state.is_playing,
                        current_time: state.current_time,
                        duration: state.duration,
                        volume: state.volume,
                        is_muted: state.is_muted,
                        is_loading: state.is_loading,
                        error: state.error.clone(),
                        updated_at: timestamp_now(),
                    };
                    let _ = reply.send(audio_state);
                }
                AudioCommand::IsFinished(reply) => {
                    let is_finished = if let Some(ref s) = sink {
                        s.empty() && state.is_playing
                    } else {
                        false
                    };
                    let _ = reply.send(is_finished);
                }
                AudioCommand::MarkFinished => {
                    state.is_playing = false;
                    state.current_time = state.duration;
                    state.start_time = None;
                    state.pause_offset = Duration::ZERO;
                }
                AudioCommand::Shutdown => {
                    if let Some(ref s) = sink {
                        s.stop();
                    }
                    break;
                }
            },
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Continue polling
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

    // Get duration if available
    let duration = source.total_duration().map(|d| d.as_secs_f64()).unwrap_or(0.0);

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

    println!("[audio] Loaded successfully, duration: {:.2}s", duration);
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
        }
    }
}

fn timestamp_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
