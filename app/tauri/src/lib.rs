pub mod commands;
pub mod domain;
pub mod server;
pub mod webview;

use commands::{clear_pending_import, get_pending_import, get_server_config, PendingImport};
use webview::{
    close_child_webview, create_child_webview, hide_child_webview, show_child_webview,
    update_child_webview, webview_exists,
};
use domain::AppState;
use parking_lot::Mutex;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Manager, RunEvent};
use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Enable GPU acceleration on Windows by ignoring the GPU blocklist
    // This ensures hardware-accelerated rendering for video playback (e.g., YouTube)
    #[cfg(target_os = "windows")]
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--ignore-gpu-blocklist --enable-gpu-rasterization --enable-accelerated-video-decode",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN
                        | tauri_plugin_window_state::StateFlags::DECORATIONS
                        | tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .on_window_event(|window, event| {
            // When the main window is closed, close all display windows and exit
            if let WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    println!("[window-event] Main window close requested");

                    // Get all webview windows
                    let app_handle = window.app_handle();
                    let windows = app_handle.webview_windows();

                    // Close all display windows and custom-page webviews
                    let child_windows: Vec<_> = windows
                        .into_iter()
                        .filter(|(label, _)| {
                            label.starts_with("display-") || label.starts_with("custom-page-")
                        })
                        .collect();

                    println!(
                        "[window-event] Closing {} child windows/webviews",
                        child_windows.len()
                    );

                    for (label, win) in child_windows {
                        println!("[window-event] Closing: {label}");
                        if let Err(e) = win.close() {
                            println!("[window-event] Failed to close {label}: {e}");
                        }
                    }

                    // Also close any child webviews
                    let webviews = app_handle.webviews();
                    let custom_webviews: Vec<_> = webviews
                        .into_iter()
                        .filter(|(label, _)| label.starts_with("custom-page-"))
                        .collect();

                    for (label, wv) in custom_webviews {
                        println!("[window-event] Closing webview: {label}");
                        if let Err(e) = wv.close() {
                            println!("[window-event] Failed to close webview {label}: {e}");
                        }
                    }

                    // Small delay to allow windows to close gracefully
                    std::thread::sleep(std::time::Duration::from_millis(100));

                    // Exit the application
                    println!("[window-event] Exiting application");
                    app_handle.exit(0);
                }
            }
        })
        .setup(|app| {
            let server_port: u16 = 3000;

            let app_state = AppState {
                server: Arc::new(Mutex::new(None)),
                server_port,
            };
            app.manage(app_state);

            // Handle file association - check CLI args for PPTX file
            let pending_import = PendingImport {
                file_path: Mutex::new(None),
            };

            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let path = PathBuf::from(&args[1]);
                if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("pptx")) {
                    println!("[file-association] PPTX file detected: {path:?}");
                    *pending_import.file_path.lock() = Some(path);
                }
            }

            app.manage(pending_import);

            // In dev mode, the server is started by beforeDevCommand, so skip sidecar
            // In release mode, start the sidecar server
            #[cfg(not(debug_assertions))]
            {
                // Start the sidecar server
                if let Err(err) = server::start_server(app.handle(), server_port) {
                    println!("[sidecar] Failed to start the server: {err}");
                }

                // Wait for server to be ready before showing UI
                if let Err(err) = server::wait_for_server_ready(server_port, 30) {
                    println!("[sidecar] {err}");
                }
            }

            #[cfg(debug_assertions)]
            {
                println!("[dev] Skipping sidecar - using dev server from beforeDevCommand");
                // Wait for dev server to be ready
                if let Err(err) = server::wait_for_server_ready(server_port, 30) {
                    println!("[dev] {err}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_config,
            get_pending_import,
            clear_pending_import,
            create_child_webview,
            close_child_webview,
            show_child_webview,
            hide_child_webview,
            update_child_webview,
            webview_exists
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            match event {
                RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                    // Only shutdown sidecar in release mode (we started it)
                    #[cfg(not(debug_assertions))]
                    if let Err(e) = server::shutdown_server(app_handle) {
                        println!("[sidecar] Failed to shut down server on exit: {e}");
                    }
                }
                _ => {}
            }
        });
}
