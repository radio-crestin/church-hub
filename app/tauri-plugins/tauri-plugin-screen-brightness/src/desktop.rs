use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<ScreenBrightness> {
    Ok(ScreenBrightness)
}

/// Access to the screen-brightness APIs (no-op on desktop).
pub struct ScreenBrightness;

impl ScreenBrightness {
    pub fn set_brightness(&self, _value: f32) -> crate::Result<()> {
        // No-op on desktop
        Ok(())
    }

    pub fn get_brightness(&self) -> crate::Result<f32> {
        // Default to full brightness on desktop
        Ok(1.0)
    }
}
