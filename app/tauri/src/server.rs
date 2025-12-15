use crate::domain::AppState;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

pub fn start_server(app_handle: &AppHandle, server_port: u16) -> Result<(), String> {
    println!("[sidecar] Starting server...");
    if let Some(app_state) = app_handle.try_state::<AppState>() {
        if app_state.server.lock().is_some() {
            println!("[sidecar] Server is already running.");
            return Ok(());
        }
    }

    let shell = app_handle.shell();
    let mut sidecar = shell
        .sidecar("church-hub-sidecar")
        .map_err(|err| err.to_string())?;

    sidecar = sidecar.env("TZ", "UTC");
    sidecar = sidecar.env("NODE_ENV", "production");
    sidecar = sidecar.env("TAURI_MODE", "true");
    sidecar = sidecar.env("PORT", server_port.to_string());

    let (mut rx, child) = sidecar.spawn().map_err(|err| err.to_string())?;

    if let Some(app_state) = app_handle.try_state::<AppState>() {
        let mut server_lock = app_state.server.lock();
        *server_lock = Some(child);
    }

    let app_handle_clone = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(data) => {
                    if let Ok(text) = String::from_utf8(data) {
                        let line = text.trim();
                        #[cfg(debug_assertions)]
                        println!("[sidecar] Server stdout: {line}");
                    }
                }
                CommandEvent::Stderr(data) => {
                    #[cfg(debug_assertions)]
                    if let Ok(text) = String::from_utf8(data) {
                        eprintln!("[sidecar] Server stderr: {}", text.trim());
                    }
                }
                CommandEvent::Terminated(code) => {
                    println!("[sidecar] Server terminated with code {code:?}");

                    // Clear server reference
                    if let Some(app_state) = app_handle_clone.try_state::<AppState>() {
                        let mut server_lock = app_state.server.lock();
                        *server_lock = None;
                    }
                }
                _ => {}
            }
        }
    });
    Ok(())
}

pub fn shutdown_server(app_handle: &AppHandle) -> Result<(), String> {
    println!("[sidecar] Shutting down server...");
    if let Some(app_state) = app_handle.try_state::<AppState>() {
        let mut server_lock = app_state.server.lock();
        if server_lock.is_none() {
            println!("[sidecar] Server is not running. Shutdown not needed.");
            return Ok(());
        }
        if let Some(mut server) = server_lock.take() {
            server.write("SIDECAR SHUTDOWN\n".as_bytes()).ok();
            match server.kill() {
                Ok(_) => {
                    println!("[sidecar] Server terminated successfully.");
                    return Ok(());
                }
                Err(err) => {
                    println!("[sidecar] Failed to terminate server.");
                    return Err(err.to_string());
                }
            }
        };
    }
    Ok(())
}
