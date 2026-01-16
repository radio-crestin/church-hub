use crate::domain::AppState;
use std::process::Command;
use std::time::{Duration, Instant};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use tokio::time::sleep;

/// Information about a process using a port
#[derive(Debug, Clone)]
pub struct PortProcessInfo {
    pub pid: u32,
    pub name: String,
}

/// Checks if a port is in use by attempting to bind to it
/// Returns true if the port is already in use (cannot bind)
pub fn is_port_in_use(port: u16) -> bool {
    use std::net::TcpListener;

    // Try to bind to the port - if it fails, the port is in use
    match TcpListener::bind(format!("127.0.0.1:{}", port)) {
        Ok(_listener) => {
            // Successfully bound, port is free
            // The listener will be dropped here, releasing the port
            false
        }
        Err(_) => {
            // Failed to bind, port is in use
            true
        }
    }
}

/// Gets information about the process using a specific port
/// Returns None if no process is using the port or if we can't determine the process
#[cfg(target_os = "macos")]
pub fn get_port_process_info(port: u16) -> Option<PortProcessInfo> {
    // Use lsof to find the process using the port
    let output = Command::new("lsof")
        .args(["-i", &format!(":{}", port), "-t"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let pid_str = String::from_utf8_lossy(&output.stdout);
    let pid: u32 = pid_str.trim().lines().next()?.parse().ok()?;

    // Get process name using ps
    let ps_output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .ok()?;

    let name = String::from_utf8_lossy(&ps_output.stdout)
        .trim()
        .to_string();

    Some(PortProcessInfo {
        pid,
        name: if name.is_empty() {
            "Unknown".to_string()
        } else {
            name
        },
    })
}

#[cfg(target_os = "windows")]
pub fn get_port_process_info(port: u16) -> Option<PortProcessInfo> {
    // Use netstat to find the PID
    let output = Command::new("netstat")
        .args(["-ano"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    let port_str = format!(":{}", port);

    for line in output_str.lines() {
        if line.contains(&port_str) && line.contains("LISTENING") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(pid_str) = parts.last() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    // Get process name using tasklist
                    let tasklist_output = Command::new("tasklist")
                        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
                        .output()
                        .ok()?;

                    let name = String::from_utf8_lossy(&tasklist_output.stdout)
                        .split(',')
                        .next()
                        .map(|s| s.trim_matches('"').to_string())
                        .unwrap_or_else(|| "Unknown".to_string());

                    return Some(PortProcessInfo { pid, name });
                }
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
pub fn get_port_process_info(port: u16) -> Option<PortProcessInfo> {
    // Use ss or lsof to find the process
    let output = Command::new("lsof")
        .args(["-i", &format!(":{}", port), "-t"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let pid_str = String::from_utf8_lossy(&output.stdout);
    let pid: u32 = pid_str.trim().lines().next()?.parse().ok()?;

    // Get process name from /proc
    let name = std::fs::read_to_string(format!("/proc/{}/comm", pid))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "Unknown".to_string());

    Some(PortProcessInfo { pid, name })
}

/// Kills the process using a specific port
#[cfg(target_os = "macos")]
pub fn kill_port_process(port: u16) -> Result<(), String> {
    let output = Command::new("lsof")
        .args(["-i", &format!(":{}", port), "-t"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("No process found on port".to_string());
    }

    let pid_str = String::from_utf8_lossy(&output.stdout);
    for pid in pid_str.trim().lines() {
        println!("[port-conflict] Killing process with PID: {}", pid);
        let kill_result = Command::new("kill")
            .args(["-9", pid])
            .output()
            .map_err(|e| e.to_string())?;

        if !kill_result.status.success() {
            return Err(format!("Failed to kill process {}", pid));
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn kill_port_process(port: u16) -> Result<(), String> {
    if let Some(info) = get_port_process_info(port) {
        println!("[port-conflict] Killing process with PID: {}", info.pid);
        let kill_result = Command::new("taskkill")
            .args(["/F", "/PID", &info.pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;

        if !kill_result.status.success() {
            return Err(format!("Failed to kill process {}", info.pid));
        }
        Ok(())
    } else {
        Err("No process found on port".to_string())
    }
}

#[cfg(target_os = "linux")]
pub fn kill_port_process(port: u16) -> Result<(), String> {
    let output = Command::new("lsof")
        .args(["-i", &format!(":{}", port), "-t"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("No process found on port".to_string());
    }

    let pid_str = String::from_utf8_lossy(&output.stdout);
    for pid in pid_str.trim().lines() {
        println!("[port-conflict] Killing process with PID: {}", pid);
        let kill_result = Command::new("kill")
            .args(["-9", pid])
            .output()
            .map_err(|e| e.to_string())?;

        if !kill_result.status.success() {
            return Err(format!("Failed to kill process {}", pid));
        }
    }
    Ok(())
}

/// Waits for the server to be ready by polling the /ping endpoint (async version)
pub async fn wait_for_server_ready_async(port: u16, timeout_secs: u64) -> Result<(), String> {
    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);
    let url = format!("http://127.0.0.1:{}/ping", port);

    println!("[sidecar] Waiting for server to be ready on port {port}...");

    while start.elapsed() < timeout {
        // Use tokio::task::spawn_blocking for the HTTP request to avoid blocking async runtime
        let url_clone = url.clone();
        let result = tokio::task::spawn_blocking(move || {
            ureq::get(&url_clone)
                .timeout(Duration::from_millis(500))
                .call()
        })
        .await;

        match result {
            Ok(Ok(response)) if response.status() == 200 => {
                println!(
                    "[sidecar] Server is ready! (took {:.2}s)",
                    start.elapsed().as_secs_f64()
                );
                return Ok(());
            }
            _ => {
                sleep(Duration::from_millis(100)).await;
            }
        }
    }

    Err(format!(
        "Server failed to become ready within {} seconds",
        timeout_secs
    ))
}

/// Waits for the server to be ready by polling the /ping endpoint (sync version for setup hook)
pub fn wait_for_server_ready(port: u16, timeout_secs: u64) -> Result<(), String> {
    // Run the async version using Tauri's runtime
    tauri::async_runtime::block_on(wait_for_server_ready_async(port, timeout_secs))
}

pub fn start_server(app_handle: &AppHandle, server_port: u16) -> Result<(), String> {
    println!("[sidecar] Starting server...");
    if let Some(app_state) = app_handle.try_state::<AppState>() {
        if app_state.server.lock().is_some() {
            println!("[sidecar] Server is already running.");
            return Ok(());
        }
    }

    let t = Instant::now();
    let shell = app_handle.shell();
    let mut sidecar = shell
        .sidecar("church-hub-sidecar")
        .map_err(|err| err.to_string())?;
    println!("[startup] sidecar_create: {:?}", t.elapsed());

    let t = Instant::now();
    sidecar = sidecar.env("TZ", "UTC");
    sidecar = sidecar.env("NODE_ENV", "production");
    sidecar = sidecar.env("TAURI_MODE", "true");
    sidecar = sidecar.env("PORT", server_port.to_string());

    // Pass the client dist path for static file serving
    if let Ok(resource_dir) = app_handle.path().resolve("client-dist", BaseDirectory::Resource) {
        let resource_path = resource_dir.to_string_lossy().to_string();
        println!("[sidecar] Client dist path: {}", resource_path);
        sidecar = sidecar.env("CLIENT_DIST_PATH", resource_path);
    }
    println!("[startup] sidecar_env_setup: {:?}", t.elapsed());

    let t = Instant::now();
    let (mut rx, child) = sidecar.spawn().map_err(|err| err.to_string())?;
    println!("[startup] sidecar_process_spawn: {:?}", t.elapsed());

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
                        println!("[sidecar] stdout: {line}");
                    }
                }
                CommandEvent::Stderr(data) => {
                    if let Ok(text) = String::from_utf8(data) {
                        eprintln!("[sidecar] stderr: {}", text.trim());
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

/// Restarts the sidecar server (async version - preferred)
pub async fn restart_server_async(app_handle: &AppHandle) -> Result<(), String> {
    println!("[sidecar] Restarting server...");

    // Get the server port from app state
    let server_port = if let Some(app_state) = app_handle.try_state::<AppState>() {
        app_state.server_port
    } else {
        3000 // fallback
    };

    // Shutdown the server
    shutdown_server(app_handle)?;

    // Wait a bit for cleanup using async sleep (doesn't block main thread)
    sleep(Duration::from_millis(500)).await;

    // Start the server again
    start_server(app_handle, server_port)?;

    // Wait for server to be ready using async version
    wait_for_server_ready_async(server_port, 30).await?;

    println!("[sidecar] Server restarted successfully.");
    Ok(())
}
