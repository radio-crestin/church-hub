use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use super::player::{create_audio_player, AudioPlayerHandle};

/// Audio command sent from the server
#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
pub enum ServerAudioCommand {
    #[serde(rename = "audio_load")]
    Load { payload: LoadPayload },
    #[serde(rename = "audio_play")]
    Play,
    #[serde(rename = "audio_pause")]
    Pause,
    #[serde(rename = "audio_stop")]
    Stop,
    #[serde(rename = "audio_seek")]
    Seek { payload: SeekPayload },
    #[serde(rename = "audio_volume")]
    Volume { payload: VolumePayload },
    #[serde(rename = "audio_mute")]
    Mute { payload: MutePayload },
}

#[derive(Deserialize, Debug)]
pub struct LoadPayload {
    pub path: String,
}

#[derive(Deserialize, Debug)]
pub struct SeekPayload {
    pub time: f64,
}

#[derive(Deserialize, Debug)]
pub struct VolumePayload {
    pub level: f64,
}

#[derive(Deserialize, Debug)]
pub struct MutePayload {
    pub muted: bool,
}

/// State update sent to the server
#[derive(Serialize)]
struct AudioStateUpdate {
    #[serde(rename = "type")]
    msg_type: &'static str,
    payload: AudioStatePayload,
}

#[derive(Serialize)]
struct AudioStatePayload {
    #[serde(rename = "isPlaying")]
    is_playing: bool,
    #[serde(rename = "currentTime")]
    current_time: f64,
    duration: f64,
    volume: f64,
    #[serde(rename = "isMuted")]
    is_muted: bool,
    #[serde(rename = "isLoading")]
    is_loading: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(rename = "updatedAt")]
    updated_at: u64,
}

/// Track finished notification
#[derive(Serialize)]
struct AudioFinished {
    #[serde(rename = "type")]
    msg_type: &'static str,
    payload: AudioFinishedPayload,
}

#[derive(Serialize)]
struct AudioFinishedPayload {
    reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(rename = "finishedAt")]
    finished_at: u64,
}

/// Registration message
#[derive(Serialize)]
struct RegistrationMessage {
    #[serde(rename = "type")]
    msg_type: &'static str,
    payload: RegistrationPayload,
}

#[derive(Serialize)]
struct RegistrationPayload {
    version: String,
}

/// Ping message for keepalive
#[derive(Serialize)]
struct PingMessage {
    #[serde(rename = "type")]
    msg_type: &'static str,
}

/// Start the audio controller WebSocket client
pub fn start_audio_controller(server_port: u16) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to create Tokio runtime");

        rt.block_on(async move {
            let server_url = format!("ws://127.0.0.1:{}/ws", server_port);

            loop {
                println!("[audio] Connecting to server at {}...", server_url);

                match run_audio_client(&server_url).await {
                    Ok(_) => {
                        println!("[audio] Connection closed, reconnecting...");
                    }
                    Err(e) => {
                        println!("[audio] Connection error: {}, reconnecting in 3s...", e);
                    }
                }

                tokio::time::sleep(Duration::from_secs(3)).await;
            }
        });
    });
}

async fn run_audio_client(server_url: &str) -> Result<(), String> {
    // Use the URL string directly - tokio-tungstenite accepts &str
    let (ws_stream, _) = connect_async(server_url)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    println!("[audio] Connected to server");

    let (write, mut read) = ws_stream.split();
    let write = Arc::new(tokio::sync::Mutex::new(write));

    // Create audio player on its own thread
    let player = create_audio_player()
        .map_err(|e| format!("Failed to create audio player: {}", e))?;

    // Create channel for sending messages
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Send registration message
    let reg_msg = RegistrationMessage {
        msg_type: "audio_controller_register",
        payload: RegistrationPayload {
            version: "1.0.0".to_string(),
        },
    };
    tx.send(serde_json::to_string(&reg_msg).unwrap()).ok();

    // Spawn write task
    let write_clone = Arc::clone(&write);
    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let mut w = write_clone.lock().await;
            if w.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Spawn state update task - only sends updates when state actually changes
    let player_clone = player.clone();
    let tx_clone = tx.clone();
    let state_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(100));
        let mut finished_sent = false;

        // Track previous state to detect changes
        let mut prev_is_playing = false;
        let mut prev_current_time: f64 = 0.0;
        let mut prev_duration: f64 = 0.0;
        let mut prev_volume: f64 = 1.0;
        let mut prev_is_muted = false;
        let mut prev_is_loading = false;

        loop {
            interval.tick().await;

            let state = player_clone.get_state();
            let is_finished = player_clone.is_finished();

            // Check if track finished playing
            if prev_is_playing && is_finished && !finished_sent {
                finished_sent = true;
                player_clone.mark_finished();

                let finished_msg = AudioFinished {
                    msg_type: "audio_finished",
                    payload: AudioFinishedPayload {
                        reason: "eof".to_string(),
                        error: None,
                        finished_at: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    },
                };

                if tx_clone
                    .send(serde_json::to_string(&finished_msg).unwrap())
                    .is_err()
                {
                    break;
                }
                println!("[audio] Track finished, notified server");
            }

            // Reset finished flag when a new track starts
            if state.is_playing && !prev_is_playing {
                finished_sent = false;
            }

            // Only send state update if something changed
            // For currentTime, only send if changed by more than 0.05s (to avoid micro-updates)
            let time_changed = (state.current_time - prev_current_time).abs() > 0.05;
            let state_changed = state.is_playing != prev_is_playing
                || time_changed
                || state.duration != prev_duration
                || state.volume != prev_volume
                || state.is_muted != prev_is_muted
                || state.is_loading != prev_is_loading;

            if state_changed {
                let state_msg = AudioStateUpdate {
                    msg_type: "audio_state_update",
                    payload: AudioStatePayload {
                        is_playing: state.is_playing,
                        current_time: state.current_time,
                        duration: state.duration,
                        volume: state.volume,
                        is_muted: state.is_muted,
                        is_loading: state.is_loading,
                        error: state.error.clone(),
                        updated_at: state.updated_at,
                    },
                };

                if tx_clone
                    .send(serde_json::to_string(&state_msg).unwrap())
                    .is_err()
                {
                    break;
                }

                // Update previous state
                prev_is_playing = state.is_playing;
                prev_current_time = state.current_time;
                prev_duration = state.duration;
                prev_volume = state.volume;
                prev_is_muted = state.is_muted;
                prev_is_loading = state.is_loading;
            }
        }
    });

    // Spawn ping task for keepalive
    let tx_ping = tx.clone();
    let ping_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            let ping = PingMessage { msg_type: "ping" };
            if tx_ping.send(serde_json::to_string(&ping).unwrap()).is_err() {
                break;
            }
        }
    });

    // Read incoming messages and handle commands
    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(cmd) = serde_json::from_str::<ServerAudioCommand>(&text) {
                    handle_command(&player, cmd);
                }
            }
            Ok(Message::Close(_)) => {
                println!("[audio] Server closed connection");
                break;
            }
            Err(e) => {
                println!("[audio] Read error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    player.shutdown();
    write_task.abort();
    state_task.abort();
    ping_task.abort();

    Ok(())
}

fn handle_command(player: &AudioPlayerHandle, command: ServerAudioCommand) {
    match command {
        ServerAudioCommand::Load { payload } => {
            player.load(&payload.path);
        }
        ServerAudioCommand::Play => player.play(),
        ServerAudioCommand::Pause => player.pause(),
        ServerAudioCommand::Stop => player.stop(),
        ServerAudioCommand::Seek { payload } => player.seek(payload.time),
        ServerAudioCommand::Volume { payload } => player.set_volume(payload.level),
        ServerAudioCommand::Mute { payload } => player.set_muted(payload.muted),
    }
}
