pub mod commands;
pub mod crypto;
pub mod domain;
pub mod server;
use commands::get_server_config;
use domain::AppState;
use parking_lot::Mutex;
use std::net::TcpListener;
use std::sync::Arc;
#[cfg(not(debug_assertions))]
use tauri::{Manager, RunEvent};
#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
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
        .setup(|app| {
            let sk = crypto::generate_secret_hex();

            let listener = TcpListener::bind("127.0.0.1:0")?;
            let server_port = listener.local_addr()?.port();

            let app_state = AppState {
                app_secret_key: sk,
                server: Arc::new(Mutex::new(None)),
                server_port: server_port,
            };
            app.manage(app_state);

            #[cfg(not(debug_assertions))]
            if let Err(err) = server::start_server(app.handle(), server_port) {
                println!("[sidecar] Failed to start the server: {}", err);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_config])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, _event| {
            #[cfg(not(debug_assertions))]
            match _event {
                RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                    if let Err(e) = server::shutdown_server(_app_handle) {
                        println!("[sidecar] Failed to shut down server on exit: {}", e);
                    }
                }
                _ => {}
            }
        });
}
