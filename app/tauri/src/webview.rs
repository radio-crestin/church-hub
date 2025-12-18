use std::time::Duration;
use tauri::{webview::WebviewBuilder, LogicalPosition, LogicalSize, Manager, WebviewUrl};
use tokio::time::sleep;

// Modern Chrome user agent to ensure compatibility with sites like WhatsApp Web
const CHROME_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Maximum retries for getting main window (handles timing issues during startup)
const MAX_MAIN_WINDOW_RETRIES: u32 = 10;
const RETRY_DELAY_MS: u64 = 200;

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
    let webview_url = WebviewUrl::External(
        url.parse()
            .map_err(|e| format!("Invalid URL '{}': {}", url, e))?,
    );

    // Build and add the child webview with modern Chrome user agent
    // Note: We don't use auto_resize() because we want to control the exact position
    let webview_builder = WebviewBuilder::new(&label, webview_url)
        .user_agent(CHROME_USER_AGENT);

    // Get the window reference for add_child
    let window = main_window.as_ref().window();

    window
        .add_child(
            webview_builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| format!("Failed to create child webview: {}", e))?;

    println!("[webview] Child webview '{}' created successfully", label);

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
