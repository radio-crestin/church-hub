---
id: T-031
title: "Rewrite screen sharing in native Rust: capture windows/screens, render natively, stream to browser screens, configurable position"
kind: task
level: normal
order: 28
status: backlog
progress: 0
createdAt: 2026-10-04T00:00:00.000Z
updatedAt: 2026-10-06T21:05:18.844Z
---

## Goal
Chat 16/09 Iosif: «ne trebuie un layer nativ in tauri pentru a face screen sharing la un windows/desktop pe videoproiector ... sa pot proiecta pe aceste ecrane un fel de screenshare la fereastra de powerpoint» + «sau daca putem integra direct cumva powerpoint ...» + «sau cand se face drag and drop la o prezentare powerpoint in aplicatie, sa folosim Google Slides ...». Today: WebRTC getDisplayMedia share (useScreenShare.ts) only. Add a native Tauri capture of a chosen window/display, shown on any screens; cross-platform.

## Notes

- 2026-10-05: User 2026-10-05: «rewrite the screen sharing functionality to use native rust to capture and decode it on the screens and also stream it to rendering browsers but for native things, render it natively with rust, add test cases, capture windows, screens and so on.. allow configuring the position of this screen sharing..»
Scope now: replace the WebRTC getDisplayMedia share (useScreenShare.ts) with a Rust pipeline: native capture of a chosen window or whole screen (all 3 OSes) → native screens (Tauri windows) render it natively in Rust; browser screens get it streamed and decode it there. Configurable position/size of the share on each screen. Test cases (Rust unit/integration + e2e for the browser side).
