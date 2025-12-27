use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BrightnessResult {
    pub brightness: f32,
}

#[cfg(target_os = "ios")]
mod ios {
    use objc::{class, msg_send, sel, sel_impl};
    use objc::runtime::Object;

    pub fn set_brightness(value: f32) {
        unsafe {
            let ui_screen: *mut Object = msg_send![class!(UIScreen), mainScreen];
            let _: () = msg_send![ui_screen, setBrightness: value as f64];
        }
    }

    pub fn get_brightness() -> f32 {
        unsafe {
            let ui_screen: *mut Object = msg_send![class!(UIScreen), mainScreen];
            let brightness: f64 = msg_send![ui_screen, brightness];
            brightness as f32
        }
    }
}

#[cfg(not(target_os = "ios"))]
mod ios {
    pub fn set_brightness(_value: f32) {
        // No-op on non-iOS platforms
    }

    pub fn get_brightness() -> f32 {
        1.0 // Default to full brightness on non-iOS
    }
}

#[tauri::command]
fn set_brightness(value: f32) -> Result<(), String> {
    let clamped = value.clamp(0.0, 1.0);
    ios::set_brightness(clamped);
    Ok(())
}

#[tauri::command]
fn get_brightness() -> Result<BrightnessResult, String> {
    Ok(BrightnessResult {
        brightness: ios::get_brightness(),
    })
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("screen-brightness")
        .invoke_handler(tauri::generate_handler![set_brightness, get_brightness])
        .build()
}
