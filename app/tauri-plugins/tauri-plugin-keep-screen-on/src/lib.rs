use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::KeepScreenOn;
#[cfg(mobile)]
use mobile::KeepScreenOn;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the keep-screen-on APIs.
pub trait KeepScreenOnExt<R: Runtime> {
  fn keep_screen_on(&self) -> &KeepScreenOn<R>;
}

impl<R: Runtime, T: Manager<R>> crate::KeepScreenOnExt<R> for T {
  fn keep_screen_on(&self) -> &KeepScreenOn<R> {
    self.state::<KeepScreenOn<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("keep-screen-on")
    .invoke_handler(tauri::generate_handler![commands::keep_screen_on])
    .setup(|app, api| {
      #[cfg(mobile)]
      let keep_screen_on = mobile::init(app, api)?;
      #[cfg(desktop)]
      let keep_screen_on = desktop::init(app, api)?;
      app.manage(keep_screen_on);
      Ok(())
    })
    .build()
}
