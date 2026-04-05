use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc;
use std::time::Duration;

use rodio::{Decoder, OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};

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
    let (stream, stream_handle) = match OutputStream::try_default() {
        Ok(pair) => pair,
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

    let mut sink = Sink::try_new(&stream_handle).expect("Failed to create audio sink");
    let mut current_file: Option<String> = None;
    let mut duration_secs: f64 = 0.0;
    let mut volume: f32 = 0.5;
    let mut is_muted = false;
    sink.set_volume(volume);

    // Keep stream alive
    let _stream = stream;

    for cmd in cmd_rx {
        match cmd {
            AudioCommand::PlayFile { path, reply } => {
                let result = (|| -> Result<(), String> {
                    let file = File::open(&path)
                        .map_err(|e| format!("Failed to open file: {e}"))?;
                    let reader = BufReader::new(file);
                    let source = Decoder::new(reader)
                        .map_err(|e| format!("Failed to decode audio: {e}"))?;

                    let dur = source.total_duration().map(|d| d.as_secs_f64()).unwrap_or(0.0);

                    // Stop current playback and recreate sink
                    sink.stop();
                    sink = Sink::try_new(&stream_handle)
                        .map_err(|e| format!("Failed to recreate sink: {e}"))?;
                    sink.set_volume(if is_muted { 0.0 } else { volume });
                    sink.append(source);

                    current_file = Some(path);
                    duration_secs = dur;
                    Ok(())
                })();
                let _ = reply.send(result);
            }
            AudioCommand::Pause => {
                sink.pause();
            }
            AudioCommand::Resume => {
                sink.play();
            }
            AudioCommand::Stop => {
                sink.stop();
                sink = Sink::try_new(&stream_handle).unwrap_or_else(|_| {
                    // This shouldn't fail, but handle gracefully
                    panic!("Failed to recreate sink after stop");
                });
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    // =========================================================================
    // AudioPlayer tests (command channel + state management)
    // =========================================================================

    #[test]
    fn new_player_returns_default_state() {
        let player = AudioPlayer::new();
        let state = player.get_state();

        assert!(!state.is_playing);
        assert_eq!(state.current_time, 0.0);
        assert_eq!(state.duration, 0.0);
        assert_eq!(state.volume, 50.0);
        assert!(!state.is_muted);
        assert!(state.current_file.is_none());
    }

    #[test]
    fn set_volume_updates_state() {
        let player = AudioPlayer::new();
        player.set_volume(75.0);
        let state = player.get_state();
        assert_eq!(state.volume, 75.0);
    }

    #[test]
    fn set_volume_zero() {
        let player = AudioPlayer::new();
        player.set_volume(0.0);
        let state = player.get_state();
        assert_eq!(state.volume, 0.0);
    }

    #[test]
    fn set_volume_100() {
        let player = AudioPlayer::new();
        player.set_volume(100.0);
        let state = player.get_state();
        assert_eq!(state.volume, 100.0);
    }

    #[test]
    fn set_muted_true() {
        let player = AudioPlayer::new();
        player.set_muted(true);
        let state = player.get_state();
        assert!(state.is_muted);
    }

    #[test]
    fn set_muted_false() {
        let player = AudioPlayer::new();
        player.set_muted(true);
        player.set_muted(false);
        let state = player.get_state();
        assert!(!state.is_muted);
    }

    #[test]
    fn pause_without_playing_does_not_crash() {
        let player = AudioPlayer::new();
        player.pause(); // Should not panic
        let state = player.get_state();
        assert!(!state.is_playing);
    }

    #[test]
    fn resume_without_playing_does_not_crash() {
        let player = AudioPlayer::new();
        player.resume(); // Should not panic
    }

    #[test]
    fn stop_without_playing_does_not_crash() {
        let player = AudioPlayer::new();
        player.stop(); // Should not panic
        let state = player.get_state();
        assert!(!state.is_playing);
        assert!(state.current_file.is_none());
    }

    #[test]
    fn play_nonexistent_file_returns_error() {
        let player = AudioPlayer::new();
        let result = player.play_file("/nonexistent/path/to/file.mp3");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open file"));
    }

    #[test]
    fn seek_without_playing_does_not_crash() {
        let player = AudioPlayer::new();
        // Seek on empty sink - may succeed or fail gracefully
        let _ = player.seek(10.0);
    }

    #[test]
    fn multiple_volume_changes() {
        let player = AudioPlayer::new();
        for level in [0.0, 25.0, 50.0, 75.0, 100.0] {
            player.set_volume(level);
            let state = player.get_state();
            assert_eq!(state.volume, level);
        }
    }

    #[test]
    fn mute_preserves_volume() {
        let player = AudioPlayer::new();
        player.set_volume(80.0);
        player.set_muted(true);

        let state = player.get_state();
        assert!(state.is_muted);
        assert_eq!(state.volume, 80.0); // Volume value preserved even when muted
    }

    // =========================================================================
    // AudioState serialization tests
    // =========================================================================

    #[test]
    fn audio_state_serializes_to_json() {
        let state = AudioState {
            is_playing: true,
            current_time: 42.5,
            duration: 180.0,
            volume: 75.0,
            is_muted: false,
            current_file: Some("/path/to/song.mp3".to_string()),
        };

        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"is_playing\":true"));
        assert!(json.contains("\"current_time\":42.5"));
        assert!(json.contains("\"duration\":180.0"));
        assert!(json.contains("\"volume\":75.0"));
        assert!(json.contains("\"is_muted\":false"));
        assert!(json.contains("/path/to/song.mp3"));
    }

    #[test]
    fn audio_state_serializes_null_file() {
        let state = AudioState {
            is_playing: false,
            current_time: 0.0,
            duration: 0.0,
            volume: 50.0,
            is_muted: false,
            current_file: None,
        };

        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"current_file\":null"));
    }

    #[test]
    fn default_state_function_returns_correct_values() {
        let state = default_state();
        assert!(!state.is_playing);
        assert_eq!(state.current_time, 0.0);
        assert_eq!(state.duration, 0.0);
        assert_eq!(state.volume, 50.0);
        assert!(!state.is_muted);
        assert!(state.current_file.is_none());
    }

    // =========================================================================
    // Request deserialization tests
    // =========================================================================

    #[test]
    fn play_request_deserializes() {
        let json = r#"{"path":"/music/song.mp3"}"#;
        let req: PlayRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.path, "/music/song.mp3");
    }

    #[test]
    fn seek_request_deserializes() {
        let json = r#"{"time":42.5}"#;
        let req: SeekRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.time, 42.5);
    }

    #[test]
    fn volume_request_deserializes() {
        let json = r#"{"level":75.0}"#;
        let req: VolumeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.level, 75.0);
    }

    #[test]
    fn mute_request_deserializes() {
        let json_true = r#"{"muted":true}"#;
        let req: MuteRequest = serde_json::from_str(json_true).unwrap();
        assert!(req.muted);

        let json_false = r#"{"muted":false}"#;
        let req: MuteRequest = serde_json::from_str(json_false).unwrap();
        assert!(!req.muted);
    }

    #[test]
    fn invalid_json_fails_deserialization() {
        let result = serde_json::from_str::<PlayRequest>("not json");
        assert!(result.is_err());
    }

    #[test]
    fn missing_field_fails_deserialization() {
        let result = serde_json::from_str::<PlayRequest>(r#"{"wrong":"field"}"#);
        assert!(result.is_err());
    }

    // =========================================================================
    // HTTP server integration tests
    // =========================================================================

    fn send_http_request(port: u16, method: &str, path: &str, body: Option<&str>) -> (u16, String) {
        let mut stream = std::net::TcpStream::connect(format!("127.0.0.1:{port}")).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();

        let body_str = body.unwrap_or("");
        let request = format!(
            "{method} {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body_str}",
            body_str.len()
        );
        stream.write_all(request.as_bytes()).unwrap();

        let mut response = String::new();
        let _ = stream.read_to_string(&mut response);

        // Parse status code
        let status_line = response.lines().next().unwrap_or("");
        let status: u16 = status_line
            .split_whitespace()
            .nth(1)
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);

        // Parse body
        let body = response
            .find("\r\n\r\n")
            .map(|i| response[i + 4..].to_string())
            .unwrap_or_default();

        (status, body)
    }

    #[test]
    fn http_health_endpoint() {
        let player = AudioPlayer::new();
        let port = 13200;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, body) = send_http_request(port, "GET", "/health", None);
        assert_eq!(status, 200);
        assert!(body.contains("\"ok\":true"));
    }

    #[test]
    fn http_state_endpoint_returns_json() {
        let player = AudioPlayer::new();
        let port = 13201;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, body) = send_http_request(port, "GET", "/state", None);
        assert_eq!(status, 200);

        let state: AudioState = serde_json::from_str(&body).unwrap();
        assert!(!state.is_playing);
        assert_eq!(state.volume, 50.0);
    }

    #[test]
    fn http_volume_endpoint() {
        let player = AudioPlayer::new();
        let port = 13202;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/volume", Some(r#"{"level":80}"#));
        assert_eq!(status, 200);

        // Verify state reflects the change
        let (_, body) = send_http_request(port, "GET", "/state", None);
        let state: AudioState = serde_json::from_str(&body).unwrap();
        assert_eq!(state.volume, 80.0);
    }

    #[test]
    fn http_mute_endpoint() {
        let player = AudioPlayer::new();
        let port = 13203;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/mute", Some(r#"{"muted":true}"#));
        assert_eq!(status, 200);

        let (_, body) = send_http_request(port, "GET", "/state", None);
        let state: AudioState = serde_json::from_str(&body).unwrap();
        assert!(state.is_muted);
    }

    #[test]
    fn http_pause_and_resume_endpoints() {
        let player = AudioPlayer::new();
        let port = 13204;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/pause", None);
        assert_eq!(status, 200);

        let (status, _) = send_http_request(port, "POST", "/resume", None);
        assert_eq!(status, 200);
    }

    #[test]
    fn http_stop_endpoint() {
        let player = AudioPlayer::new();
        let port = 13205;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/stop", None);
        assert_eq!(status, 200);

        let (_, body) = send_http_request(port, "GET", "/state", None);
        let state: AudioState = serde_json::from_str(&body).unwrap();
        assert!(!state.is_playing);
        assert!(state.current_file.is_none());
    }

    #[test]
    fn http_play_nonexistent_file_returns_500() {
        let player = AudioPlayer::new();
        let port = 13206;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, body) = send_http_request(
            port,
            "POST",
            "/play",
            Some(r#"{"path":"/nonexistent/file.mp3"}"#),
        );
        assert_eq!(status, 500);
        assert!(body.contains("error"));
    }

    #[test]
    fn http_invalid_json_returns_400() {
        let player = AudioPlayer::new();
        let port = 13207;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/play", Some("not json"));
        assert_eq!(status, 400);
    }

    #[test]
    fn http_unknown_route_returns_404() {
        let player = AudioPlayer::new();
        let port = 13208;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, body) = send_http_request(port, "GET", "/unknown", None);
        assert_eq!(status, 404);
        assert!(body.contains("Not found"));
    }

    #[test]
    fn http_seek_bad_json_returns_400() {
        let player = AudioPlayer::new();
        let port = 13209;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/seek", Some(r#"{"wrong":"field"}"#));
        assert_eq!(status, 400);
    }

    #[test]
    fn http_volume_bad_json_returns_400() {
        let player = AudioPlayer::new();
        let port = 13210;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/volume", Some("{}"));
        assert_eq!(status, 400);
    }

    #[test]
    fn http_mute_bad_json_returns_400() {
        let player = AudioPlayer::new();
        let port = 13211;
        start_audio_server(player, port);
        std::thread::sleep(Duration::from_millis(100));

        let (status, _) = send_http_request(port, "POST", "/mute", Some("invalid"));
        assert_eq!(status, 400);
    }
}
