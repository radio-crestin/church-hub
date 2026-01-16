use crate::domain::{AppState, ServerConfig};
use parking_lot::Mutex;
use std::path::PathBuf;


/// State for storing pending PPTX file import from file association
pub struct PendingImport {
    pub file_path: Mutex<Option<PathBuf>>,
}

/// State for storing current zoom level per webview
#[cfg(desktop)]
pub struct ZoomState {
    pub zoom_levels: Mutex<std::collections::HashMap<String, f64>>,
}

#[tauri::command]
pub fn get_server_config(app_state: tauri::State<AppState>) -> Result<ServerConfig, String> {
    let server_config = ServerConfig {
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

/// Toggle DevTools for the calling webview
#[cfg(desktop)]
#[tauri::command]
pub fn toggle_devtools(webview: tauri::Webview) {
    if webview.is_devtools_open() {
        webview.close_devtools();
    } else {
        webview.open_devtools();
    }
}

/// Zoom in the calling webview
#[cfg(desktop)]
#[tauri::command]
pub fn zoom_in(
    webview: tauri::Webview,
    zoom_state: tauri::State<ZoomState>,
) -> Result<f64, String> {
    let label = webview.label().to_string();
    let mut levels = zoom_state.zoom_levels.lock();
    let current = *levels.get(&label).unwrap_or(&1.0);
    let new_zoom = (current + 0.1).min(3.0);
    levels.insert(label, new_zoom);

    webview
        .set_zoom(new_zoom)
        .map_err(|e| format!("Failed to set zoom: {e}"))?;

    Ok(new_zoom)
}

/// Zoom out the calling webview
#[cfg(desktop)]
#[tauri::command]
pub fn zoom_out(
    webview: tauri::Webview,
    zoom_state: tauri::State<ZoomState>,
) -> Result<f64, String> {
    let label = webview.label().to_string();
    let mut levels = zoom_state.zoom_levels.lock();
    let current = *levels.get(&label).unwrap_or(&1.0);
    let new_zoom = (current - 0.1).max(0.3);
    levels.insert(label, new_zoom);

    webview
        .set_zoom(new_zoom)
        .map_err(|e| format!("Failed to set zoom: {e}"))?;

    Ok(new_zoom)
}

/// Reset zoom to default (100%)
#[cfg(desktop)]
#[tauri::command]
pub fn reset_zoom(
    webview: tauri::Webview,
    zoom_state: tauri::State<ZoomState>,
) -> Result<f64, String> {
    let label = webview.label().to_string();
    let mut levels = zoom_state.zoom_levels.lock();
    levels.insert(label, 1.0);

    webview
        .set_zoom(1.0)
        .map_err(|e| format!("Failed to set zoom: {e}"))?;

    Ok(1.0)
}

/// Restart the sidecar server (database connection will be re-initialized)
#[cfg(desktop)]
#[tauri::command]
pub async fn restart_server(app_handle: tauri::AppHandle) -> Result<(), String> {
    crate::server::restart_server_async(&app_handle).await
}
