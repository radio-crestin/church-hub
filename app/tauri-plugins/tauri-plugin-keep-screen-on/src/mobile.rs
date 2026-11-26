use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "net.curiana.keepScreenOn";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_keep_screen_on);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<KeepScreenOn<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "KeepScreenOnPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_keep_screen_on)?;
  Ok(KeepScreenOn(handle))
}

/// Access to the keep-screen-on APIs.
pub struct KeepScreenOn<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> KeepScreenOn<R> {
  pub fn keep_screen_on(&self, enable: bool) -> crate::Result<()> {
    self
      .0
      .run_mobile_plugin("keepScreenOn", enable)
      .map_err(Into::into)
  }
}
