//! Unified error reporting for the Tauri shell.
//!
//! Mirrors the server's `reportError` helper: every recoverable error worth
//! recording goes to BOTH the on-disk log (`tauri-YYYY-MM-DD.log`) AND PostHog
//! in a single call, so a field failure is never console-only. Panics already
//! go through both via the panic hook; this covers the non-panic paths
//! (sidecar crash/exit, server-ready timeout, port cleanup, shutdown).

use serde_json::{json, Value};

use crate::logging;
use crate::posthog;

/// Report a recoverable error to BOTH the log file and PostHog.
pub fn error(context: &str, message: &str, props: Value) {
    logging::log_line("ERROR", &format!("[{context}] {message}"));
    posthog::capture_exception(context, message, "error", props);
}

/// Report a warning to BOTH the log file and PostHog.
pub fn warn(context: &str, message: &str, props: Value) {
    logging::log_line("WARN", &format!("[{context}] {message}"));
    let mut properties = props;
    if !properties.is_object() {
        properties = json!({});
    }
    if let Some(map) = properties.as_object_mut() {
        map.insert("context".to_string(), json!(context));
        map.insert("message".to_string(), json!(message));
        map.insert("level".to_string(), json!("warning"));
    }
    posthog::capture_event("tauri_warning", properties);
}
