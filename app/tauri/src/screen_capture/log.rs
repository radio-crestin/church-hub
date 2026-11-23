//! Screen-capture logs, filtered by `CHURCH_HUB_SCREEN_CAPTURE_LOG`
//! (trace, debug, verbose, info, warning, error; default info), written to
//! the Tauri log file and stdout.

use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Level {
    Trace,
    Debug,
    Verbose,
    Info,
    Warning,
    Error,
}

impl Level {
    fn parse(s: &str) -> Option<Level> {
        match s.trim().to_ascii_lowercase().as_str() {
            "trace" => Some(Level::Trace),
            "debug" => Some(Level::Debug),
            "verbose" => Some(Level::Verbose),
            "info" => Some(Level::Info),
            "warning" | "warn" => Some(Level::Warning),
            "error" => Some(Level::Error),
            _ => None,
        }
    }
}

fn threshold() -> Level {
    static THRESHOLD: OnceLock<Level> = OnceLock::new();
    *THRESHOLD.get_or_init(|| {
        std::env::var("CHURCH_HUB_SCREEN_CAPTURE_LOG")
            .ok()
            .and_then(|v| Level::parse(&v))
            .unwrap_or(Level::Info)
    })
}

pub fn log(level: Level, message: &str) {
    if level < threshold() {
        return;
    }
    let line = format!("[screen-capture] {message}");
    println!("{line}");
    crate::logging::log_line(&format!("{level:?}").to_ascii_uppercase(), &line);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_every_level_and_orders_them() {
        assert_eq!(Level::parse(" Warning "), Some(Level::Warning));
        assert_eq!(Level::parse("warn"), Some(Level::Warning));
        assert_eq!(Level::parse("nope"), None);
        assert!(Level::Trace < Level::Debug && Level::Verbose < Level::Info);
        assert!(Level::Info < Level::Warning && Level::Warning < Level::Error);
    }
}
