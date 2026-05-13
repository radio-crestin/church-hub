use std::sync::OnceLock;
use std::time::Duration;

use serde_json::{json, Value};

struct Config {
    project_token: String,
    host: String,
    distinct_id: String,
}

static CONFIG: OnceLock<Config> = OnceLock::new();

pub fn init(project_token: String, host: String, distinct_id: String) {
    let _ = CONFIG.set(Config {
        project_token,
        host,
        distinct_id,
    });
}

fn endpoint(host: &str) -> String {
    let trimmed = host.trim_end_matches('/');
    format!("{trimmed}/i/v0/e/")
}

fn build_payload(cfg: &Config, event: &str, props: Value) -> Value {
    let mut properties = props;
    if !properties.is_object() {
        properties = json!({});
    }
    if let Some(map) = properties.as_object_mut() {
        map.entry("component".to_string())
            .or_insert(json!("tauri"));
        map.entry("platform".to_string())
            .or_insert(json!(std::env::consts::OS));
    }

    json!({
        "api_key": cfg.project_token,
        "event": event,
        "distinct_id": cfg.distinct_id,
        "properties": properties,
    })
}

pub fn capture_event(event: &str, props: Value) {
    let Some(cfg) = CONFIG.get() else { return };

    let url = endpoint(&cfg.host);
    let payload = build_payload(cfg, event, props);

    // fire-and-forget; we don't await
    tauri::async_runtime::spawn(async move {
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
        {
            Ok(c) => c,
            Err(_) => return,
        };
        let _ = client.post(url).json(&payload).send().await;
    });
}

/// Synchronous capture used inside panic hooks — must complete before abort.
pub fn capture_panic_blocking(message: &str, location: &str) {
    let Some(cfg) = CONFIG.get() else { return };

    let url = endpoint(&cfg.host);
    let payload = build_payload(
        cfg,
        "$exception",
        json!({
            "$exception_type": "Panic",
            "$exception_message": message,
            "$exception_level": "fatal",
            "location": location,
        }),
    );

    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(_) => return,
    };
    let _ = client.post(url).json(&payload).send();
}
