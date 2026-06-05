use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri_plugin_shell::process::CommandChild;

pub struct AppState {
    pub server: Arc<Mutex<Option<CommandChild>>>,
    pub server_port: u16,
    /// Set true while we intentionally stop/restart the sidecar so the
    /// process-event loop can tell a deliberate kill from an unexpected crash
    /// (only the latter is reported as an error).
    pub shutting_down: Arc<AtomicBool>,
}

impl Drop for AppState {
    fn drop(&mut self) {
        // App is exiting — a kill here is expected, not a crash.
        self.shutting_down.store(true, Ordering::SeqCst);
        if let Some(child) = self.server.lock().take() {
            if let Err(e) = child.kill() {
                let msg = format!("Failed to kill server on drop: {e}");
                eprintln!("[sidecar] {msg}");
                crate::report::error("sidecar-drop", &msg, serde_json::json!({}));
            } else {
                println!("[sidecar] Server killed on AppState drop.");
            }
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub server_port: u16,
}
