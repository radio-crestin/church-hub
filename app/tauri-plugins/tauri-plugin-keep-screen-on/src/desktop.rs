use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<KeepScreenOn<R>> {
  Ok(KeepScreenOn(app.clone()))
}

/// Access to the keep-screen-on APIs.
pub struct KeepScreenOn<R: Runtime>(AppHandle<R>);

impl<R: Runtime> KeepScreenOn<R> {
  pub fn keep_screen_on(&self, _: bool) -> crate::Result<()> {
    Ok(())
  }
}
