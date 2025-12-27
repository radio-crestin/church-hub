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
pub use desktop::ScreenBrightness;
#[cfg(mobile)]
pub use mobile::ScreenBrightness;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the screen-brightness APIs.
#[cfg(desktop)]
pub trait ScreenBrightnessExt<R: Runtime> {
    fn screen_brightness(&self) -> &ScreenBrightness;
}

#[cfg(desktop)]
impl<R: Runtime, T: Manager<R>> ScreenBrightnessExt<R> for T {
    fn screen_brightness(&self) -> &ScreenBrightness {
        self.state::<ScreenBrightness>().inner()
    }
}

#[cfg(mobile)]
pub trait ScreenBrightnessExt<R: Runtime> {
    fn screen_brightness(&self) -> &ScreenBrightness<R>;
}

#[cfg(mobile)]
impl<R: Runtime, T: Manager<R>> ScreenBrightnessExt<R> for T {
    fn screen_brightness(&self) -> &ScreenBrightness<R> {
        self.state::<ScreenBrightness<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("screen-brightness")
        .invoke_handler(tauri::generate_handler![
            commands::set_brightness,
            commands::get_brightness
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let screen_brightness = mobile::init(app, api)?;
            #[cfg(desktop)]
            let screen_brightness = desktop::init(app, api)?;
            app.manage(screen_brightness);
            Ok(())
        })
        .build()
}
