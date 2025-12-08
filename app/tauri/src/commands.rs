use crate::{
    crypto,
    domain::{AppState, ServerConfig},
};
use parking_lot::Mutex;
use std::path::PathBuf;

/// State for storing pending PPTX file import from file association
pub struct PendingImport {
    pub file_path: Mutex<Option<PathBuf>>,
}

#[tauri::command]
pub fn get_server_config(app_state: tauri::State<AppState>) -> Result<ServerConfig, String> {
    let secret_key = &app_state.app_secret_key;
    let token = crypto::generate_token(secret_key, ""); // pass custom payload if you like

    let server_config = ServerConfig {
        auth_token: token,
        server_port: app_state.server_port,
    };
    Ok(server_config)
}

/// Gets the pending import file path if one exists (from file association)
#[tauri::command]
pub fn get_pending_import(state: tauri::State<PendingImport>) -> Option<String> {
    state
        .file_path
        .lock()
        .take()
        .map(|p| p.to_string_lossy().to_string())
}

/// Clears the pending import (called after import is handled)
#[tauri::command]
pub fn clear_pending_import(state: tauri::State<PendingImport>) {
    *state.file_path.lock() = None;
}
