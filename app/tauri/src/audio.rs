mod smooth_seek;

use std::fs::File;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::Duration;

use rodio::{Decoder, OutputStreamBuilder, Sink, Source};
use serde::{Deserialize, Serialize};

use smooth_seek::SmoothSeek;

/// Commands sent to the audio thread.
enum AudioCommand {
    PlayFile {
        path: String,
        reply: mpsc::Sender<Result<(), String>>,
    },
    Pause,
    Resume,
    Stop,
    Seek {
        time: f64,
        reply: mpsc::Sender<Result<(), String>>,
    },
    SetVolume {
        level: f64,
    },
    SetMuted {
        muted: bool,
    },
    GetState {
        reply: mpsc::Sender<AudioState>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AudioState {
    pub is_playing: bool,
    pub current_time: f64,
    pub duration: f64,
    pub volume: f64,
    pub is_muted: bool,
    pub current_file: Option<String>,
}

#[derive(Deserialize)]
struct PlayRequest {
    path: String,
}

#[derive(Deserialize)]
struct SeekRequest {
    time: f64,
}

#[derive(Deserialize)]
struct VolumeRequest {
    level: f64,
}

#[derive(Deserialize)]
struct MuteRequest {
    muted: bool,
}

/// Handle to the audio player running on a dedicated thread.
#[derive(Clone)]
pub struct AudioPlayer {
    cmd_tx: mpsc::Sender<AudioCommand>,
}

impl AudioPlayer {
    /// Spawn a new audio player on a dedicated thread.
    /// The OutputStream (which is !Send on macOS) stays on that thread.
    pub fn new() -> Self {
        let (cmd_tx, cmd_rx) = mpsc::channel::<AudioCommand>();

        std::thread::spawn(move || {
            audio_thread_loop(cmd_rx);
        });

        Self { cmd_tx }
    }

    pub fn play_file(&self, path: &str) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.cmd_tx
            .send(AudioCommand::PlayFile {
                path: path.to_string(),
                reply: reply_tx,
            })
            .map_err(|_| "Audio thread not running".to_string())?;
        reply_rx
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| "Audio thread timeout".to_string())?
    }

    pub fn pause(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Pause);
    }

    pub fn resume(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Resume);
    }

    pub fn stop(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Stop);
    }

    pub fn seek(&self, time_secs: f64) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.cmd_tx
            .send(AudioCommand::Seek {
                time: time_secs,
                reply: reply_tx,
            })
            .map_err(|_| "Audio thread not running".to_string())?;
        reply_rx
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| "Audio thread timeout".to_string())?
    }

    pub fn set_volume(&self, level: f64) {
        let _ = self.cmd_tx.send(AudioCommand::SetVolume { level });
    }

    pub fn set_muted(&self, muted: bool) {
        let _ = self.cmd_tx.send(AudioCommand::SetMuted { muted });
    }

    pub fn get_state(&self) -> AudioState {
        let (reply_tx, reply_rx) = mpsc::channel();
        if self.cmd_tx.send(AudioCommand::GetState { reply: reply_tx }).is_err() {
            return default_state();
        }
        reply_rx.recv_timeout(Duration::from_secs(2)).unwrap_or_else(|_| default_state())
    }
}

fn default_state() -> AudioState {
    AudioState {
        is_playing: false,
        current_time: 0.0,
        duration: 0.0,
        volume: 50.0,
        is_muted: false,
        current_file: None,
    }
}

/// The audio thread loop — owns the OutputStream and Sink.
fn audio_thread_loop(cmd_rx: mpsc::Receiver<AudioCommand>) {
    // Initialize audio output
    let mut stream = match OutputStreamBuilder::open_default_stream() {
        Ok(stream) => stream,
        Err(e) => {
            eprintln!("[audio] Failed to open audio output: {e}");
            // Drain commands so senders don't block
            for cmd in cmd_rx {
                match cmd {
                    AudioCommand::PlayFile { reply, .. } => {
                        let _ = reply.send(Err(format!("No audio output: {e}")));
                    }
                    AudioCommand::Seek { reply, .. } => {
                        let _ = reply.send(Err(format!("No audio output: {e}")));
                    }
                    AudioCommand::GetState { reply } => {
                        let _ = reply.send(default_state());
                    }
                    _ => {}
                }
            }
            return;
        }
    };

    stream.log_on_drop(false);
    let mut sink = Sink::connect_new(stream.mixer());
    let paused = Arc::new(AtomicBool::new(false));
    let mut current_file: Option<String> = None;
    let mut duration_secs: f64 = 0.0;
    let mut volume: f32 = 0.5;
    let mut is_muted = false;
    sink.set_volume(volume);

    for cmd in cmd_rx {
        match cmd {
            AudioCommand::PlayFile { path, reply } => {
                let result = (|| -> Result<(), String> {
                    let file = File::open(&path)
                        .map_err(|e| format!("Failed to open file: {e}"))?;
                    // From the file itself, so the decoder knows its length and can seek back
                    let source = Decoder::try_from(file)
                        .map_err(|e| format!("Failed to decode audio: {e}"))?;

                    let dur = source.total_duration().map(|d| d.as_secs_f64()).unwrap_or(0.0);

                    // Stop current playback and recreate sink
                    sink.stop();
                    sink = Sink::connect_new(stream.mixer());
                    sink.set_volume(if is_muted { 0.0 } else { volume });
                    paused.store(false, Ordering::SeqCst);
                    sink.append(SmoothSeek::new(source, paused.clone()));

                    current_file = Some(path);
                    duration_secs = dur;
                    Ok(())
                })();
                let _ = reply.send(result);
            }
            AudioCommand::Pause => {
                paused.store(true, Ordering::SeqCst);
                sink.pause();
            }
            AudioCommand::Resume => {
                paused.store(false, Ordering::SeqCst);
                sink.play();
            }
            AudioCommand::Stop => {
                sink.stop();
                sink = Sink::connect_new(stream.mixer());
                sink.set_volume(if is_muted { 0.0 } else { volume });
                current_file = None;
                duration_secs = 0.0;
            }
            AudioCommand::Seek { time, reply } => {
                let result = sink
                    .try_seek(Duration::from_secs_f64(time))
                    .map_err(|e| format!("Seek failed: {e}"));
                let _ = reply.send(result);
            }
            AudioCommand::SetVolume { level } => {
                volume = (level / 100.0) as f32;
                if !is_muted {
                    sink.set_volume(volume);
                }
            }
            AudioCommand::SetMuted { muted } => {
                is_muted = muted;
                sink.set_volume(if muted { 0.0 } else { volume });
            }
            AudioCommand::GetState { reply } => {
                let is_playing = !sink.is_paused() && !sink.empty();
                let state = AudioState {
                    is_playing,
                    current_time: sink.get_pos().as_secs_f64(),
                    duration: duration_secs,
                    volume: (volume * 100.0) as f64,
                    is_muted,
                    current_file: current_file.clone(),
                };
                let _ = reply.send(state);
            }
        }
    }
}

/// Start the internal audio HTTP server for the sidecar to communicate with.
pub fn start_audio_server(player: AudioPlayer, port: u16) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind(format!("127.0.0.1:{port}")) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[audio-server] Failed to bind port {port}: {e}");
                return;
            }
        };
        println!("[audio-server] Listening on 127.0.0.1:{port}");

        for stream in listener.incoming() {
            let stream = match stream {
                Ok(s) => s,
                Err(_) => continue,
            };
            let player = player.clone();
            std::thread::spawn(move || {
                handle_http_request(stream, &player);
            });
        }
    });
}

fn handle_http_request(mut stream: std::net::TcpStream, player: &AudioPlayer) {
    use std::io::{Read, Write};

    let mut buf = [0u8; 8192];
    let n = match stream.read(&mut buf) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let request = String::from_utf8_lossy(&buf[..n]);
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }

    let method = parts[0];
    let path = parts[1];

    // Extract body for POST requests
    let body = request
        .find("\r\n\r\n")
        .map(|i| &request[i + 4..])
        .unwrap_or("");

    let (status, response_body) = match (method, path) {
        ("POST", "/play") => match serde_json::from_str::<PlayRequest>(body) {
            Ok(req) => match player.play_file(&req.path) {
                Ok(()) => (200, r#"{"ok":true}"#.to_string()),
                Err(e) => (500, format!(r#"{{"error":"{}"}}"#, e.replace('"', "\\\""))),
            },
            Err(e) => (400, format!(r#"{{"error":"Bad request: {}"}}"#, e)),
        },
        ("POST", "/pause") => {
            player.pause();
            (200, r#"{"ok":true}"#.to_string())
        }
        ("POST", "/resume") => {
            player.resume();
            (200, r#"{"ok":true}"#.to_string())
        }
        ("POST", "/stop") => {
            player.stop();
            (200, r#"{"ok":true}"#.to_string())
        }
        ("POST", "/seek") => match serde_json::from_str::<SeekRequest>(body) {
            Ok(req) => match player.seek(req.time) {
                Ok(()) => (200, r#"{"ok":true}"#.to_string()),
                Err(e) => (500, format!(r#"{{"error":"{}"}}"#, e.replace('"', "\\\""))),
            },
            Err(e) => (400, format!(r#"{{"error":"Bad request: {}"}}"#, e)),
        },
        ("POST", "/volume") => match serde_json::from_str::<VolumeRequest>(body) {
            Ok(req) => {
                player.set_volume(req.level);
                (200, r#"{"ok":true}"#.to_string())
            }
            Err(e) => (400, format!(r#"{{"error":"Bad request: {}"}}"#, e)),
        },
        ("POST", "/mute") => match serde_json::from_str::<MuteRequest>(body) {
            Ok(req) => {
                player.set_muted(req.muted);
                (200, r#"{"ok":true}"#.to_string())
            }
            Err(e) => (400, format!(r#"{{"error":"Bad request: {}"}}"#, e)),
        },
        ("GET", "/state") => {
            let state = player.get_state();
            let json = serde_json::to_string(&state).unwrap_or_default();
            (200, json)
        }
        ("GET", "/health") => (200, r#"{"ok":true}"#.to_string()),
        _ => (404, r#"{"error":"Not found"}"#.to_string()),
    };

    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        match status { 200 => "OK", 400 => "Bad Request", 404 => "Not Found", _ => "Internal Server Error" },
        response_body.len(),
        response_body
    );

    let _ = stream.write_all(response.as_bytes());
}
