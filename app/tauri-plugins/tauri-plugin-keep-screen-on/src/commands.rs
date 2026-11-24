use tauri::{AppHandle, command, Runtime};

use crate::Result;
use crate::KeepScreenOnExt;

#[command]
pub(crate) async fn keep_screen_on<R: Runtime>(
    app: AppHandle<R>,
    enable: bool,
) -> Result<()> {
    app.keep_screen_on().keep_screen_on(enable)
}
