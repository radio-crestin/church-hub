//! A capture source's id as the operator UI sees it: `monitor:<id>` for a
//! whole screen, `window:<id>` for one window (xcap's own ids).

use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceId {
    Monitor(u32),
    Window(u32),
}

impl fmt::Display for SourceId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SourceId::Monitor(id) => write!(f, "monitor:{id}"),
            SourceId::Window(id) => write!(f, "window:{id}"),
        }
    }
}

impl FromStr for SourceId {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (kind, id) = s
            .split_once(':')
            .ok_or_else(|| format!("invalid source id: {s}"))?;
        let id: u32 = id.parse().map_err(|_| format!("invalid source id: {s}"))?;
        match kind {
            "monitor" => Ok(SourceId::Monitor(id)),
            "window" => Ok(SourceId::Window(id)),
            _ => Err(format!("invalid source id: {s}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_both_kinds() {
        for id in [SourceId::Monitor(65537), SourceId::Window(0)] {
            assert_eq!(id.to_string().parse::<SourceId>(), Ok(id));
        }
        assert_eq!(SourceId::Window(42).to_string(), "window:42");
    }

    #[test]
    fn rejects_malformed_ids() {
        for bad in ["", "monitor", "monitor:", "screen:1", "window:-1", "window:x"] {
            assert!(bad.parse::<SourceId>().is_err(), "{bad} should be refused");
        }
    }
}
