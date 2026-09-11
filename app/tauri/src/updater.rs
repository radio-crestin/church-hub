//! In-app updates, around `tauri-plugin-updater`.
//!
//! The plugin checks the release manifest, verifies the minisign signature,
//! downloads and runs the platform install (NSIS in passive update mode on
//! Windows, a bundle swap on macOS). Two things it does not do live here:
//!
//! * Stopping the sidecar before the app goes away. On Windows the plugin
//!   leaves through `std::process::exit`, which never reaches the run loop's
//!   exit handling, so a sidecar that is still running would keep
//!   `church-hub-sidecar.exe` locked while the installer tries to replace it.
//! * Reporting whether the update landed. The installer runs after this
//!   process is gone, so a marker written beforehand is read back on the
//!   next launch and compared with the version that is actually running.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::domain::AppState;
use crate::logging;

const PENDING_FILE: &str = "app-update-pending.json";
const SIDECAR_STOP_TIMEOUT: Duration = Duration::from_secs(5);
const SIDECAR_START_TIMEOUT_SECS: u64 = 30;

/// Written right before the app hands over to the installer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub from: String,
    pub to: String,
    pub started_at: String,
}

/// What the previous launch's update attempt turned out to be.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum UpdateOutcome {
    /// The app now runs the version the update was for.
    Updated { from: String, to: String },
    /// The app came back on some other version — nearly always the old one,
    /// meaning the installer never finished.
    Failed {
        from: String,
        to: String,
        current: String,
    },
}

/// Held until the frontend asks for it, once.
pub struct UpdateOutcomeState(pub Mutex<Option<UpdateOutcome>>);

fn pending_path() -> Option<PathBuf> {
    logging::data_dir().map(|dir| dir.join(PENDING_FILE))
}

/// What a pending marker means now that `current_version` is running.
pub fn classify(pending: &PendingUpdate, current_version: &str) -> UpdateOutcome {
    if pending.to == current_version {
        UpdateOutcome::Updated {
            from: pending.from.clone(),
            to: pending.to.clone(),
        }
    } else {
        UpdateOutcome::Failed {
            from: pending.from.clone(),
            to: pending.to.clone(),
            current: current_version.to_string(),
        }
    }
}

/// Reads and removes the marker at `path`, if there is one.
///
/// Whatever it says is about the run that just ended, so it is removed
/// either way: a stale or unreadable marker must not greet every later
/// launch.
pub fn resolve_pending_at(path: &Path, current_version: &str) -> Option<UpdateOutcome> {
    let raw = fs::read_to_string(path).ok()?;
    let _ = fs::remove_file(path);
    let pending: PendingUpdate = match serde_json::from_str(&raw) {
        Ok(pending) => pending,
        Err(err) => {
            logging::log_line(
                "WARN",
                &format!("[updater] unreadable pending marker {}: {err}", path.display()),
            );
            return None;
        }
    };
    Some(classify(&pending, current_version))
}

fn write_pending(path: &Path, pending: &PendingUpdate) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|err| format!("cannot create {}: {err}", dir.display()))?;
    }
    let json = serde_json::to_string_pretty(pending).map_err(|err| err.to_string())?;
    fs::write(path, json).map_err(|err| format!("cannot write {}: {err}", path.display()))
}

/// Resolves the marker left by the previous run and keeps the answer for
/// the frontend. Call once, from setup.
pub fn init(app: &tauri::App) {
    let current = app.package_info().version.to_string();
    let outcome = pending_path().and_then(|path| resolve_pending_at(&path, &current));
    match &outcome {
        Some(UpdateOutcome::Updated { from, to }) => {
            logging::log_line("INFO", &format!("[updater] updated {from} -> {to}"));
        }
        Some(UpdateOutcome::Failed { from, to, current }) => {
            logging::log_line(
                "ERROR",
                &format!("[updater] update {from} -> {to} did not land; running {current}"),
            );
        }
        None => {}
    }
    app.manage(UpdateOutcomeState(Mutex::new(outcome)));
}

/// The sidecar port and whether this process started a sidecar at all —
/// in development the server is launched by `tauri dev`, not by us.
fn sidecar_status(app: &AppHandle) -> (u16, bool) {
    let state = app.state::<AppState>();
    let running = state.server.lock().is_some();
    (state.server_port, running)
}

async fn wait_for_port_release(port: u16) -> Result<(), String> {
    let deadline = Instant::now() + SIDECAR_STOP_TIMEOUT;
    while crate::server::is_port_in_use(port) {
        if Instant::now() >= deadline {
            return Err(format!(
                "the server on port {port} did not stop within {}s",
                SIDECAR_STOP_TIMEOUT.as_secs()
            ));
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Ok(())
}

/// Everything that has to happen before the installer takes over: the
/// marker for the next launch, then the sidecar — killed and waited for,
/// so the installer never meets a locked `church-hub-sidecar.exe` or a
/// port 3000 that is still taken when the new version starts.
#[tauri::command]
pub async fn prepare_update_install(app: AppHandle, version: String) -> Result<(), String> {
    let path = pending_path().ok_or("no data directory for the update marker")?;
    let pending = PendingUpdate {
        from: app.package_info().version.to_string(),
        to: version,
        started_at: chrono::Utc::now().to_rfc3339(),
    };
    write_pending(&path, &pending)?;
    logging::log_line(
        "INFO",
        &format!("[updater] installing {} -> {}", pending.from, pending.to),
    );

    let (port, owns_sidecar) = sidecar_status(&app);
    // In development the server is not ours to stop.
    if owns_sidecar {
        crate::server::shutdown_server(&app)?;
        wait_for_port_release(port).await?;
        logging::log_line("INFO", "[updater] sidecar stopped; handing over to the installer");
    }
    Ok(())
}

/// Puts things back after an install that did not happen: no marker, and
/// the sidecar running again so the app stays usable.
#[tauri::command]
pub async fn abort_update_install(app: AppHandle) -> Result<(), String> {
    if let Some(path) = pending_path() {
        let _ = fs::remove_file(path);
    }
    logging::log_line("WARN", "[updater] install aborted; restarting the sidecar");

    #[cfg(not(debug_assertions))]
    {
        let (port, running) = sidecar_status(&app);
        if !running {
            // The install may have failed because the old sidecar was still
            // holding the port; starting a new one into that would only add
            // a second failure. Give it the same grace again, then say so.
            wait_for_port_release(port)
                .await
                .map_err(|err| format!("cannot restart the server: {err}"))?;
            crate::server::start_server(&app, port)?;
            crate::server::wait_for_server_ready_async(port, SIDECAR_START_TIMEOUT_SECS).await?;
        }
    }
    #[cfg(debug_assertions)]
    let _ = (app, SIDECAR_START_TIMEOUT_SECS);
    Ok(())
}

/// The previous launch's update result — handed out once.
#[tauri::command]
pub fn take_update_outcome(state: tauri::State<UpdateOutcomeState>) -> Option<UpdateOutcome> {
    state.0.lock().take()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pending(from: &str, to: &str) -> PendingUpdate {
        PendingUpdate {
            from: from.into(),
            to: to.into(),
            started_at: "2026-09-11T00:00:00Z".into(),
        }
    }

    fn temp_marker(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("church-hub-updater-{}-{name}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir.join(PENDING_FILE)
    }

    #[test]
    fn running_the_target_version_means_updated() {
        assert_eq!(
            classify(&pending("1.0.0", "1.1.0"), "1.1.0"),
            UpdateOutcome::Updated {
                from: "1.0.0".into(),
                to: "1.1.0".into()
            }
        );
    }

    #[test]
    fn running_any_other_version_means_failed() {
        assert_eq!(
            classify(&pending("1.0.0", "1.1.0"), "1.0.0"),
            UpdateOutcome::Failed {
                from: "1.0.0".into(),
                to: "1.1.0".into(),
                current: "1.0.0".into()
            }
        );
    }

    #[test]
    fn marker_is_read_once_then_removed() {
        let path = temp_marker("once");
        write_pending(&path, &pending("1.0.0", "1.1.0")).unwrap();

        let first = resolve_pending_at(&path, "1.1.0");
        assert!(matches!(first, Some(UpdateOutcome::Updated { .. })));
        assert!(!path.exists());
        assert_eq!(resolve_pending_at(&path, "1.1.0"), None);
    }

    #[test]
    fn unreadable_marker_is_dropped_silently() {
        let path = temp_marker("garbage");
        fs::write(&path, "not json").unwrap();

        assert_eq!(resolve_pending_at(&path, "1.1.0"), None);
        assert!(!path.exists());
    }

    #[test]
    fn missing_marker_means_nothing_to_report() {
        let path = temp_marker("missing");
        assert_eq!(resolve_pending_at(&path, "1.1.0"), None);
    }
}
