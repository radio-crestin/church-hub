/// Every command in lib.rs's `generate_handler!`. Each becomes an ACL
/// permission (`allow-get-server-config`, ...) that the capabilities grant
/// through the `app-commands` set (permissions/app-commands.toml). Since
/// Tauri 2.11 a page from a remote origin may call no app command a
/// capability does not grant, and the display, song and page windows load the
/// app from the sidecar's http://127.0.0.1:<port>: their startup's
/// get_server_config was refused and the projector stayed black (T-138).
/// A command added to the handler goes here and in that set too.
const APP_COMMANDS: &[&str] = &[
    "get_server_config",
    "get_pending_import",
    "clear_pending_import",
    "create_child_webview",
    "create_native_page_window",
    "close_child_webview",
    "show_child_webview",
    "hide_child_webview",
    "update_child_webview",
    "webview_exists",
    "toggle_devtools",
    "zoom_in",
    "zoom_out",
    "reset_zoom",
    "restart_server",
    "prepare_update_install",
    "abort_update_install",
    "take_update_outcome",
    "screen_capture_sources",
    "screen_capture_start",
    "screen_capture_stop",
    "screen_share_surface_show",
    "screen_share_surface_hide",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
