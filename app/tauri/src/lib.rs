pub mod commands;
pub mod domain;

// Desktop-only modules
#[cfg(desktop)]
pub mod server;
#[cfg(desktop)]
pub mod webview;

use commands::{clear_pending_import, get_pending_import, get_server_config};
#[cfg(desktop)]
use commands::PendingImport;
#[cfg(desktop)]
use commands::{reset_zoom, toggle_devtools, zoom_in, zoom_out, ZoomState};
#[cfg(desktop)]
use webview::{
    close_child_webview, create_child_webview, hide_child_webview, show_child_webview,
    update_child_webview, webview_exists,
};
#[cfg(desktop)]
use domain::AppState;
#[cfg(desktop)]
use parking_lot::Mutex;
#[cfg(desktop)]
use std::path::PathBuf;
#[cfg(desktop)]
use std::sync::Arc;
use std::time::Instant;
#[cfg(target_os = "macos")]
use tauri::Emitter;
use tauri::RunEvent;
#[cfg(desktop)]
use tauri::Manager;
#[cfg(desktop)]
use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_start = Instant::now();
    println!("[startup] === Tauri Starting ===");

    // Enable GPU acceleration on Windows by ignoring the GPU blocklist
    // This ensures hardware-accelerated rendering for video playback (e.g., YouTube)
    #[cfg(target_os = "windows")]
    {
        let t = Instant::now();
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--ignore-gpu-blocklist --enable-gpu-rasterization --enable-accelerated-video-decode",
        );
        println!("[startup] gpu_config: {:?}", t.elapsed());
    }

    let builder_start = Instant::now();

    // Essential plugins only - minimal set for fast startup
    let t = Instant::now();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init());  // Needed for sidecar
    println!("[startup] plugin_shell: {:?}", t.elapsed());

    let t = Instant::now();
    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_keep_screen_on::init())
        .plugin(tauri_plugin_screen_brightness::init());
    println!("[startup] plugins_core: {:?}", t.elapsed());

    // Global shortcut plugin is desktop-only
    #[cfg(desktop)]
    let builder = {
        let t = Instant::now();
        let b = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
        println!("[startup] plugin_shortcut: {:?}", t.elapsed());
        b
    };

    // Window state plugin is desktop-only
    #[cfg(desktop)]
    let builder = {
        let t = Instant::now();
        let b = builder.plugin(
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
        );
        println!("[startup] plugin_window_state: {:?}", t.elapsed());
        b
    };

    // Window event handling is desktop-only (close child windows on main close)
    #[cfg(desktop)]
    let builder = builder.on_window_event(|window, event| {
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
    });

    // Desktop setup hook
    #[cfg(desktop)]
    let builder = builder.setup(move |app| {
        println!("[startup] tauri_builder: {:?}", builder_start.elapsed());
        let setup_start = Instant::now();

        let server_port: u16 = 3000;

        let t = Instant::now();
        let app_state = AppState {
            server: Arc::new(Mutex::new(None)),
            server_port,
        };
        app.manage(app_state);

        // Initialize zoom state for tracking zoom levels per webview
        let zoom_state = ZoomState {
            zoom_levels: Mutex::new(std::collections::HashMap::new()),
        };
        app.manage(zoom_state);
        println!("[startup] setup_app_state: {:?}", t.elapsed());

        // Handle file association - check CLI args for PPTX file
        let t = Instant::now();
        let pending_import = PendingImport {
            file_path: Mutex::new(None),
        };

        let args: Vec<String> = std::env::args().collect();
        if args.len() > 1 {
            let path = PathBuf::from(&args[1]);
            if path.extension().is_some_and(|ext| {
                ext.eq_ignore_ascii_case("pptx")
                    || ext.eq_ignore_ascii_case("opensong")
                    || ext.eq_ignore_ascii_case("churchprogram")
            }) {
                println!("[file-association] File detected: {path:?}");
                *pending_import.file_path.lock() = Some(path);
            }
        }

        app.manage(pending_import);
        println!("[startup] setup_file_association: {:?}", t.elapsed());

        // In dev mode, the server is started by beforeDevCommand, so skip sidecar
        // In release mode, start the sidecar server
        #[cfg(not(debug_assertions))]
        {
            // Start the sidecar server
            let t = Instant::now();
            if let Err(err) = server::start_server(app.handle(), server_port) {
                println!("[sidecar] Failed to start the server: {err}");
            }
            println!("[startup] sidecar_spawn: {:?}", t.elapsed());

            // Wait for server to be ready before showing UI
            let t = Instant::now();
            if let Err(err) = server::wait_for_server_ready(server_port, 30) {
                println!("[sidecar] {err}");
            }
            println!("[startup] server_ready_wait: {:?}", t.elapsed());
        }

        #[cfg(debug_assertions)]
        {
            println!("[dev] Skipping sidecar - using dev server from beforeDevCommand");
            // Wait for dev server to be ready
            let t = Instant::now();
            if let Err(err) = server::wait_for_server_ready(server_port, 30) {
                println!("[dev] {err}");
            }
            println!("[startup] dev_server_ready_wait: {:?}", t.elapsed());
        }

        // Inject keyboard shortcut handler into main webview
        let t = Instant::now();
        if app.webview_windows().get("main").is_some() {
            let keyboard_handler = r#"
                (function() {
                    if (window.__tauriKeyboardHandlerInstalled) return;
                    window.__tauriKeyboardHandlerInstalled = true;

                    document.addEventListener('keydown', async (e) => {
                        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                        const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

                        // F12 or Ctrl+Shift+I: Toggle DevTools
                        if (e.key === 'F12' || (ctrlOrCmd && e.shiftKey && e.key === 'I')) {
                            e.preventDefault();
                            try {
                                await window.__TAURI__.core.invoke('toggle_devtools');
                            } catch (err) {
                                console.error('Failed to toggle devtools:', err);
                            }
                            return;
                        }

                        // Ctrl/Cmd + Plus or Ctrl/Cmd + =: Zoom in
                        if (ctrlOrCmd && (e.key === '+' || e.key === '=')) {
                            e.preventDefault();
                            try {
                                await window.__TAURI__.core.invoke('zoom_in');
                            } catch (err) {
                                console.error('Failed to zoom in:', err);
                            }
                            return;
                        }

                        // Ctrl/Cmd + Minus: Zoom out
                        if (ctrlOrCmd && e.key === '-') {
                            e.preventDefault();
                            try {
                                await window.__TAURI__.core.invoke('zoom_out');
                            } catch (err) {
                                console.error('Failed to zoom out:', err);
                            }
                            return;
                        }

                        // Ctrl/Cmd + 0: Reset zoom
                        if (ctrlOrCmd && e.key === '0') {
                            e.preventDefault();
                            try {
                                await window.__TAURI__.core.invoke('reset_zoom');
                            } catch (err) {
                                console.error('Failed to reset zoom:', err);
                            }
                            return;
                        }
                    });

                    console.log('[tauri] Keyboard shortcuts installed: F12/Ctrl+Shift+I (DevTools), Ctrl+/-/0 (Zoom)');
                })();
            "#;

            // We need to inject after page load, so we'll add a listener
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                // Small delay to ensure page is loaded
                std::thread::sleep(std::time::Duration::from_millis(500));
                if let Some(wv) = handle.webview_windows().get("main") {
                    if let Err(e) = wv.eval(keyboard_handler) {
                        println!("[keyboard] Failed to inject keyboard handler: {e}");
                    } else {
                        println!("[keyboard] Keyboard shortcuts installed");
                    }
                }
            });
        }
        println!("[startup] keyboard_handler_setup: {:?}", t.elapsed());

        println!("[startup] setup_hook_total: {:?}", setup_start.elapsed());
        println!("[startup] === Tauri Ready (total: {:?}) ===", app_start.elapsed());

        Ok(())
    });

    // Mobile setup hook (simplified - no sidecar, no file association)
    #[cfg(mobile)]
    let builder = builder.setup(move |_app| {
        println!("[startup] tauri_builder: {:?}", builder_start.elapsed());
        println!("[mobile] Mobile mode - server connection configured by user");
        println!("[startup] === Tauri Ready (total: {:?}) ===", app_start.elapsed());
        Ok(())
    });

    // Desktop: include all commands including webview management
    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        get_server_config,
        get_pending_import,
        clear_pending_import,
        create_child_webview,
        close_child_webview,
        show_child_webview,
        hide_child_webview,
        update_child_webview,
        webview_exists,
        toggle_devtools,
        zoom_in,
        zoom_out,
        reset_zoom
    ]);

    // Mobile: only basic commands (no webview management)
    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        get_server_config,
        get_pending_import,
        clear_pending_import
    ]);

    println!("[startup] builder_chain_setup: {:?}", builder_start.elapsed());
    let build_start = Instant::now();

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    println!("[startup] tauri_build: {:?}", build_start.elapsed());

    app.run(|app_handle, event| {
        match event {
            // Handle file association when app is already running (macOS Apple Events only)
            #[cfg(target_os = "macos")]
            RunEvent::Opened { urls } => {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        if path.extension().is_some_and(|ext| {
                            ext.eq_ignore_ascii_case("pptx")
                                || ext.eq_ignore_ascii_case("opensong")
                                || ext.eq_ignore_ascii_case("churchprogram")
                        }) {
                            println!("[file-association] Opened event: {path:?}");

                            // Emit event to frontend
                            if let Err(e) =
                                app_handle.emit("file-opened", path.to_string_lossy().to_string())
                            {
                                println!("[file-association] Failed to emit: {e}");
                            }
                        }
                    }
                }
            }
            RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                // Only shutdown sidecar on desktop in release mode (we started it)
                #[cfg(all(desktop, not(debug_assertions)))]
                if let Err(e) = server::shutdown_server(app_handle) {
                    println!("[sidecar] Failed to shut down server on exit: {e}");
                }
            }
            _ => {}
        }
    });
}
