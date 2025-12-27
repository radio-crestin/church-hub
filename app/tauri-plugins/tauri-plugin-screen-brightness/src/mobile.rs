use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_screen_brightness);

// Initializes the Swift plugin class
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<ScreenBrightness<R>> {
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_screen_brightness)?;
    #[cfg(target_os = "android")]
    return Err(crate::Error::UnsupportedPlatform);

    Ok(ScreenBrightness(handle))
}

/// Access to the screen-brightness APIs.
pub struct ScreenBrightness<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ScreenBrightness<R> {
    pub fn set_brightness(&self, value: f32) -> crate::Result<()> {
        let clamped = value.clamp(0.0, 1.0);
        self.0
            .run_mobile_plugin("setBrightness", serde_json::json!({ "value": clamped }))
            .map_err(Into::into)
    }

    pub fn get_brightness(&self) -> crate::Result<f32> {
        let result: serde_json::Value = self
            .0
            .run_mobile_plugin("getBrightness", ())
            .map_err(Into::into)?;

        Ok(result["brightness"].as_f64().unwrap_or(1.0) as f32)
    }
}
