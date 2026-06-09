pub mod commands;
pub mod domain;
pub mod logging;
pub mod posthog;
pub mod report;

// Desktop-only modules
#[cfg(desktop)]
pub mod audio;
#[cfg(desktop)]
pub mod server;
#[cfg(desktop)]
pub mod webview;

use commands::{clear_pending_import, get_pending_import, get_server_config};
#[cfg(desktop)]
use commands::PendingImport;
#[cfg(desktop)]
use commands::{reset_zoom, restart_server, toggle_devtools, zoom_in, zoom_out, ZoomState};
#[cfg(all(desktop, not(debug_assertions)))]
use server::auto_cleanup_port;
#[cfg(desktop)]
use webview::{
    close_child_webview, create_child_webview, create_native_page_window, hide_child_webview,
    show_child_webview, update_child_webview, webview_exists,
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
use tauri::Emitter;
use tauri::RunEvent;
#[cfg(desktop)]
use tauri::Manager;
#[cfg(desktop)]
use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // File logging — initialize before anything else so we capture startup
    // events. Best-effort: a logging failure must never block the app.
    logging::init();
    logging::log_line("info", "=== Tauri Starting ===");

    // PostHog observability — token + host fall back to defaults so the app
    // still reports without an .env file present.
    let posthog_token = std::env::var("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN")
        .unwrap_or_else(|_| "phc_x4iC8SNTkLtxooGYmbz6v3nFjYE2v6wXaNgZVHNaxatK".to_string());
    let posthog_host = std::env::var("VITE_PUBLIC_POSTHOG_HOST")
        .unwrap_or_else(|_| "https://eu.i.posthog.com".to_string());
    let distinct_id = format!(
        "tauri-{}-{}",
        std::env::consts::OS,
        std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_else(|_| "unknown".to_string())
    );
    posthog::init(posthog_token, posthog_host, distinct_id);

    // Boot heartbeat — filter `app_started` + `component:"tauri"` in the
    // PostHog dashboard to confirm the Rust shell's capture path works.
    posthog::capture_event(
        "app_started",
        serde_json::json!({
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
        }),
    );

    // Panic hook: log to stderr (preserves existing console output) and ship
    // a blocking PostHog event so it flushes before the process aborts.
    let default_panic = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let msg = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic".to_string()
        };

        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());

        eprintln!("[PANIC] {} at {}", msg, location);
        logging::log_line("fatal", &format!("PANIC {} at {}", msg, location));

        posthog::capture_panic_blocking(&msg, &location);

        default_panic(info);
    }));

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
        .plugin(tauri_plugin_screen_brightness::init())
        .plugin(tauri_plugin_process::init());
    println!("[startup] plugins_core: {:?}", t.elapsed());

    // Start the embedded audio player (rodio) with internal HTTP API
    #[cfg(desktop)]
    {
        let t = std::time::Instant::now();
        let audio_player = audio::AudioPlayer::new();
        audio::start_audio_server(audio_player, 3199);
        println!("[startup] audio_server: {:?}", t.elapsed());
    }

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

    // Single-instance plugin - ensures only one instance runs, passes files to existing instance
    #[cfg(desktop)]
    let builder = {
        let t = Instant::now();
        let b = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            println!("[single-instance] Second instance launched with args: {args:?}");

            // Check if any argument is a file we handle
            for arg in args.iter().skip(1) {
                // Skip first arg (exe path)
                let path = PathBuf::from(arg);
                if path.extension().is_some_and(|ext| {
                    ext.eq_ignore_ascii_case("pptx")
                        || ext.eq_ignore_ascii_case("opensong")
                        || ext.eq_ignore_ascii_case("churchprogram")
                }) {
                    println!("[single-instance] File detected: {path:?}");

                    // Emit event to frontend so it can import the file
                    if let Err(e) = app.emit("file-opened", path.to_string_lossy().to_string()) {
                        println!("[single-instance] Failed to emit file-opened: {e}");
                    }

                    // Focus the main window
                    if let Some(window) = app.get_webview_window("main") {
                        // Unminimize if minimized
                        let _ = window.unminimize();
                        // Bring to front and focus
                        let _ = window.set_focus();
                    }

                    break; // Only handle first file
                }
            }
        }));
        println!("[startup] plugin_single_instance: {:?}", t.elapsed());
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

                // Exit the application immediately - Tauri handles cleanup gracefully
                // No need for blocking sleep which would freeze the main thread
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

        // In dev the server runs on the port from `build.devUrl` (worktree
        // configs override it, e.g. 3002) — hardcoding 3000 here would make
        // `get_server_config` point the webview at the wrong server. In
        // release the sidecar always binds 3000.
        #[cfg(debug_assertions)]
        let server_port: u16 = app
            .config()
            .build
            .dev_url
            .as_ref()
            .and_then(|url| url.port())
            .unwrap_or(3000);
        #[cfg(not(debug_assertions))]
        let server_port: u16 = 3000;

        let t = Instant::now();
        let app_state = AppState {
            server: Arc::new(Mutex::new(None)),
            server_port,
            shutting_down: Arc::new(std::sync::atomic::AtomicBool::new(false)),
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
            // Automatically clean up port if in use (kill stale processes, wait for ghost PIDs)
            let t = Instant::now();
            if let Err(e) = auto_cleanup_port(server_port) {
                println!("[port-conflict] Auto-cleanup failed: {}", e);
                report::error(
                    "port-cleanup",
                    &format!("port {} auto-cleanup failed: {}", server_port, e),
                    serde_json::json!({ "port": server_port }),
                );
                use tauri_plugin_dialog::DialogExt;
                app.dialog()
                    .message(format!(
                        "Could not free port {}:\n\n{}\n\nPlease manually close the application using this port and try again.",
                        server_port, e
                    ))
                    .title("Port Conflict")
                    .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                    .blocking_show();
                std::process::exit(1);
            }
            println!("[startup] port_cleanup: {:?}", t.elapsed());

            // Start the sidecar server
            let t = Instant::now();
            if let Err(err) = server::start_server(app.handle(), server_port) {
                println!("[sidecar] Failed to start the server: {err}");
                report::error(
                    "sidecar-spawn",
                    &format!("sidecar spawn failed: {}", err),
                    serde_json::json!({ "port": server_port }),
                );
            }
            println!("[startup] sidecar_spawn: {:?}", t.elapsed());

            // Wait for server to be ready before showing UI
            let t = Instant::now();
            if let Err(err) = server::wait_for_server_ready(server_port, 30) {
                println!("[sidecar] {err}");
                report::error(
                    "server-ready-timeout",
                    &format!("server not ready: {}", err),
                    serde_json::json!({ "port": server_port }),
                );
            } else {
                logging::log_line("info", "sidecar server ready");
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

        // Ensure the main window is visible on a connected monitor
        // (window-state plugin may restore a position from a disconnected monitor)
        let t = Instant::now();
        if let Some(main_window) = app.webview_windows().get("main") {
            if let (Ok(pos), Ok(size)) = (main_window.outer_position(), main_window.outer_size()) {
                let wx = pos.x;
                let wy = pos.y;
                let ww = size.width as i32;
                let wh = size.height as i32;

                let visible_on_any = main_window.available_monitors().map(|monitors| {
                    monitors.iter().any(|monitor| {
                        let mp = monitor.position();
                        let ms = monitor.size();
                        let mx = mp.x;
                        let my = mp.y;
                        let mw = ms.width as i32;
                        let mh = ms.height as i32;

                        // Window overlaps monitor by at least 100px in each axis
                        let overlap_x = (wx + ww).min(mx + mw) - wx.max(mx);
                        let overlap_y = (wy + wh).min(my + mh) - wy.max(my);
                        overlap_x >= 100 && overlap_y >= 50
                    })
                }).unwrap_or(false);

                if !visible_on_any {
                    println!("[window] Main window at ({wx}, {wy}) is off-screen, centering");
                    let _ = main_window.center();
                }
            }
        }
        println!("[startup] window_bounds_check: {:?}", t.elapsed());

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

                        // Prevent function keys (F1-F11) from browser default actions (e.g., F5 refresh, F6 address bar)
                        // These may be configured as shortcuts and handled by Tauri global-shortcut plugin
                        if (/^F([1-9]|1[01])$/.test(e.key)) {
                            e.preventDefault();
                            return;
                        }
                    });

                    console.log('[tauri] Keyboard handler installed: F1-F11 (prevented browser default), F12/Ctrl+Shift+I (DevTools), Ctrl+/-/0 (Zoom)');
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
        create_native_page_window,
        close_child_webview,
        show_child_webview,
        hide_child_webview,
        update_child_webview,
        webview_exists,
        toggle_devtools,
        zoom_in,
        zoom_out,
        reset_zoom,
        restart_server
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
        // Suppress unused variable warning (used conditionally per platform)
        let _ = &app_handle;
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
