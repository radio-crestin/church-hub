//! Tauri-side file logger.
//!
//! Mirrors the server's `getLogsDir()` so the Open Logs Folder button in the
//! client shows BOTH `tauri-YYYY-MM-DD.log` (Rust side) and `server-YYYY-MM-DD.log`
//! (Bun side) when the user attaches logs for a bug report.
//!
//! Cross-platform layout (must match `apps/server/src/utils/paths.ts`):
//!   - macOS:   ~/Library/Application Support/church-hub/logs
//!   - Windows: %APPDATA%/church-hub/logs
//!   - Linux:   ~/.config/church-hub/logs
//!
//! Once initialized, [`log_line`] writes a timestamped line to the day's file.
//! A `Mutex<File>` is enough — startup log volume is tiny, and serializing
//! writes avoids interleaved lines from the various spawn threads.
use std::fs::{File, OpenOptions, create_dir_all};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

fn logs_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let dir = if cfg!(target_os = "macos") {
        home.join("Library")
            .join("Application Support")
            .join("church-hub")
    } else if cfg!(target_os = "windows") {
        // dirs::config_dir() on Windows returns %APPDATA%, matching the TS side.
        dirs::config_dir().unwrap_or(home).join("church-hub")
    } else {
        // Linux + everything else
        dirs::config_dir()
            .unwrap_or_else(|| home.join(".config"))
            .join("church-hub")
    };
    Some(dir.join("logs"))
}

fn current_log_path() -> Option<PathBuf> {
    let dir = logs_dir()?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    Some(dir.join(format!("tauri-{}.log", today)))
}

static LOG_FILE: OnceLock<Mutex<Option<File>>> = OnceLock::new();

/// Open the day's log file. Silent on failure — logging is best-effort and
/// must never block app startup.
pub fn init() {
    let file = (|| -> Option<File> {
        let dir = logs_dir()?;
        if !dir.exists() {
            create_dir_all(&dir).ok()?;
        }
        let path = current_log_path()?;
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .ok()
    })();

    LOG_FILE.get_or_init(|| Mutex::new(file));
}

/// Append a line to the day's log file with an ISO-8601 timestamp.
/// Safe to call before [`init`] (becomes a no-op).
pub fn log_line(level: &str, message: &str) {
    let Some(slot) = LOG_FILE.get() else {
        return;
    };
    let Ok(mut guard) = slot.lock() else {
        return;
    };
    let Some(file) = guard.as_mut() else {
        return;
    };
    let ts = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.3f%z");
    let _ = writeln!(file, "[{}] [{}] {}", ts, level.to_uppercase(), message);
    let _ = file.flush();
}

/// Return the absolute path of the active log file, for debugging.
pub fn current_path() -> Option<PathBuf> {
    current_log_path()
}
