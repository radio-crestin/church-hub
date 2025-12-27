use tauri::{AppHandle, Runtime};

use crate::ScreenBrightnessExt;

#[tauri::command]
pub async fn set_brightness<R: Runtime>(app: AppHandle<R>, value: f32) -> Result<(), String> {
    app.screen_brightness()
        .set_brightness(value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_brightness<R: Runtime>(app: AppHandle<R>) -> Result<f32, String> {
    app.screen_brightness()
        .get_brightness()
        .map_err(|e| e.to_string())
}
