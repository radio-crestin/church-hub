use std::time::Duration;
use tauri::{
    webview::{NewWindowResponse, WebviewBuilder},
    LogicalPosition, LogicalSize, Manager, WebviewUrl,
};
use tauri_plugin_opener::OpenerExt;
use tauri_utils::config::BackgroundThrottlingPolicy;
use tokio::time::sleep;

// Modern Chrome user agents for compatibility with sites like YouTube and WhatsApp Web
// Uses OS-specific user agent strings to match the actual platform
#[cfg(target_os = "macos")]
const CHROME_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

#[cfg(target_os = "windows")]
const CHROME_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

#[cfg(target_os = "linux")]
const CHROME_USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

// Maximum retries for getting main window (handles timing issues during startup)
const MAX_MAIN_WINDOW_RETRIES: u32 = 10;
const RETRY_DELAY_MS: u64 = 200;

/// JavaScript fallback: intercept clicks and window.open, redirect external URLs
/// via location.href so the Rust on_navigation handler catches them.
/// This is a safety net for cases where on_new_window doesn't fire.
/// CSP-safe: no IPC calls, just location.href redirect.
const EXTERNAL_LINK_INTERCEPT_SCRIPT: &str = r#"
(function() {
    if (window.__churchHubLinkInterceptorInstalled) return;
    window.__churchHubLinkInterceptorInstalled = true;
    var pageOrigin = window.location.origin;
    console.log('[church-hub] Link interceptor installed for origin:', pageOrigin);

    document.addEventListener('click', function(e) {
        var el = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!el) return;
        var href = el.getAttribute('href');
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
        try {
            var url = new URL(href, window.location.href);
            if (url.origin !== pageOrigin) {
                console.log('[church-hub] External link click intercepted:', url.href);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                window.location.href = url.href;
            }
        } catch (_) {}
    }, true);

    var origOpen = window.open;
    window.open = function(url, target, features) {
        if (url) {
            try {
                var parsed = new URL(url, window.location.href);
                if (parsed.origin !== pageOrigin) {
                    console.log('[church-hub] External window.open intercepted:', parsed.href);
                    window.location.href = parsed.href;
                    return null;
                }
            } catch (_) {}
        }
        return origOpen.call(window, url, target, features);
    };
})();
"#;

/// Helper function to get the main window with retries
async fn get_main_window_with_retry(
    app: &tauri::AppHandle,
) -> Result<tauri::WebviewWindow, String> {
    for attempt in 1..=MAX_MAIN_WINDOW_RETRIES {
        // List all available windows for debugging
        let windows = app.webview_windows();
        let window_labels: Vec<_> = windows.keys().collect();
        println!(
            "[webview] Attempt {}/{}: Available windows: {:?}",
            attempt, MAX_MAIN_WINDOW_RETRIES, window_labels
        );

        if let Some(window) = app.get_webview_window("main") {
            println!("[webview] Found main window on attempt {}", attempt);
            return Ok(window);
        }

        if attempt < MAX_MAIN_WINDOW_RETRIES {
            println!(
                "[webview] Main window not found, retry {}/{}...",
                attempt, MAX_MAIN_WINDOW_RETRIES
            );
            sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
        }
    }

    // Final debug: list all windows
    let windows = app.webview_windows();
    let window_labels: Vec<_> = windows.keys().collect();

    Err(format!(
        "Main window not found after {} retries. Available windows: {:?}",
        MAX_MAIN_WINDOW_RETRIES, window_labels
    ))
}

/// Creates a child webview at a specific position and size
#[tauri::command]
pub async fn create_child_webview(
    app: tauri::AppHandle,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    println!("[webview] Creating child webview '{}'", label);
    println!("[webview] URL: {}", url);
    println!(
        "[webview] Position: ({}, {}), Size: {}x{}",
        x, y, width, height
    );

    // Get the main window with retry logic for timing issues
    let main_window = get_main_window_with_retry(&app).await?;

    // Check if webview already exists - if so, update position and show it
    if let Some(existing) = app.get_webview(&label) {
        println!("[webview] Webview '{}' already exists, updating position and showing it", label);
        existing
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| format!("Failed to set position: {}", e))?;
        existing
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| format!("Failed to set size: {}", e))?;
        existing
            .show()
            .map_err(|e| format!("Failed to show webview: {}", e))?;
        return Ok(());
    }

    // Create the webview URL
    let parsed_url: url::Url = url
        .parse()
        .map_err(|e| format!("Invalid URL '{}': {}", url, e))?;
    let webview_url = WebviewUrl::External(parsed_url.clone());

    // Extract origin for navigation filtering
    let origin = parsed_url.origin().unicode_serialization();
    let nav_origin_clone = origin.clone();
    let app_for_nav = app.clone();
    let app_for_new_window = app.clone();

    // Build and add the child webview with modern Chrome user agent
    // Note: We don't use auto_resize() because we want to control the exact position
    // Disable background throttling to ensure smooth video playback (macOS 14.0+)
    let webview_builder = WebviewBuilder::new(&label, webview_url)
        .user_agent(CHROME_USER_AGENT)
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        // Intercept direct navigation: open external URLs in system browser
        .on_navigation(move |nav_url| {
            let nav_origin = nav_url.origin().unicode_serialization();
            if nav_origin != nav_origin_clone {
                println!(
                    "[webview] External navigation intercepted: {} (origin: {} != {})",
                    nav_url, nav_origin, nav_origin_clone
                );
                if let Err(e) = app_for_nav.opener().open_url(nav_url.as_str(), None::<&str>) {
                    println!("[webview] Failed to open external URL: {}", e);
                }
                false // Block navigation in webview
            } else {
                true // Allow same-origin navigation
            }
        })
        // Intercept window.open / target="_blank": open external URLs in system browser
        .on_new_window(move |new_url, _features| {
            let new_origin = new_url.origin().unicode_serialization();
            if new_origin != origin {
                println!(
                    "[webview] New window request intercepted: {} (origin: {} != {})",
                    new_url, new_origin, origin
                );
                if let Err(e) = app_for_new_window.opener().open_url(new_url.as_str(), None::<&str>) {
                    println!("[webview] Failed to open external URL: {}", e);
                }
                NewWindowResponse::Deny // Don't open new window in app
            } else {
                NewWindowResponse::Allow // Allow same-origin popups
            }
        })
        // JS fallback: intercept clicks/window.open and redirect via location.href
        // This triggers on_navigation which opens external URLs in system browser
        .initialization_script(EXTERNAL_LINK_INTERCEPT_SCRIPT);

    // Get the window reference for add_child
    let window = main_window.as_ref().window();

    window
        .add_child(
            webview_builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| format!("Failed to create child webview: {}", e))?;

    println!("[webview] Child webview '{}' created successfully with on_navigation + on_new_window + initialization_script handlers", label);

    Ok(())
}

/// Shows a child webview at a specific position and size
#[tauri::command]
pub async fn show_child_webview(
    app: tauri::AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    println!("[webview] Showing webview '{}' at ({}, {}) size {}x{}", label, x, y, width, height);

    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("Webview '{}' not found", label))?;

    // Update position and size
    webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("Failed to set position: {}", e))?;
    webview
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| format!("Failed to set size: {}", e))?;

    webview
        .show()
        .map_err(|e| format!("Failed to show webview: {}", e))?;

    println!("[webview] Webview '{}' shown", label);
    Ok(())
}

/// Hides a child webview (keeps it running in background)
#[tauri::command]
pub async fn hide_child_webview(app: tauri::AppHandle, label: String) -> Result<(), String> {
    println!("[webview] Hiding webview '{}'", label);

    if let Some(webview) = app.get_webview(&label) {
        webview
            .hide()
            .map_err(|e| format!("Failed to hide webview: {}", e))?;
        println!("[webview] Webview '{}' hidden", label);
    } else {
        println!("[webview] Webview '{}' not found (already closed?)", label);
    }

    Ok(())
}

/// Closes a child webview by label (destroys it)
#[tauri::command]
pub async fn close_child_webview(app: tauri::AppHandle, label: String) -> Result<(), String> {
    println!("[webview] Closing webview '{}'", label);

    if let Some(webview) = app.get_webview(&label) {
        webview
            .close()
            .map_err(|e| format!("Failed to close webview '{}': {}", label, e))?;
        println!("[webview] Webview '{}' closed", label);
    } else {
        println!("[webview] Webview '{}' not found (already closed?)", label);
    }

    Ok(())
}

/// Checks if a webview exists
#[tauri::command]
pub async fn webview_exists(app: tauri::AppHandle, label: String) -> Result<bool, String> {
    Ok(app.get_webview(&label).is_some())
}

/// Repositions and resizes a child webview
#[tauri::command]
pub async fn update_child_webview(
    app: tauri::AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("Webview '{}' not found", label))?;

    webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("Failed to set position: {}", e))?;

    webview
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| format!("Failed to set size: {}", e))?;

    Ok(())
}
