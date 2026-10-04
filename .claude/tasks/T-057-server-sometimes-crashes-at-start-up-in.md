---
id: T-057
title: Server sometimes crashes at start-up in CoreMIDI init (macOS, under load)
sprint: 2026-09-28
urgent: true
status: doing
owner: midi-startup
rolled: 0
order: -13
created: 2026-10-04
---
## Goal
Found by panel-layout while fixing T-056 (2026-10-04): under machine load the server sometimes panics while initializing MIDI on macOS — "MidiInCore::initialize ... (-304)", Bun panic — 2 of 10 loaded e2e runs; it fails fast ("not able to start"). If the bundled app can hit this, Church Hub could fail to start on a busy Mac before a service. Find the root cause (CoreMIDI client creation timing/permissions, native module init on the main thread, etc.) and make MIDI init failure non-fatal (log + retry/disable MIDI) without masking real errors; must stay cross-platform.

## Notes
- 2026-10-04: Root cause (reproduced, 3 of 13 starts before fix with a delay sweep, deterministic): macOS MIDIServer quits ~5.4 s after its last client exits. A process that creates its first CoreMIDI client in that ~100 ms window gets MIDIClientCreate = -304 (log: XPC_ERROR_CONNECTION_INVALID). RtMidi (vendored in @julusian/midi 3.6.1) raises that error from getCoreMidiClientSingleton(), which is declared throw() (noexcept) -> std::terminate -> Bun "panic: A C++ exception occurred". Native abort: JS try/catch cannot catch it (verified). E2E hits it because the previous test server's exit starts that 5.4 s timer. Also: the existing --probe-midi safety check is a no-op in dev/e2e (`bun --probe-midi` just prints bun's help and exits 0). Once a process got -304 it can never create a CoreMIDI client again (verified: retries over 10 s and MIDIRestart all return -304), so in-process retry is useless. Fix: create a CoreMIDI client ourselves through bun:ffi before loading the native module (returns the error code, never throws); 0 -> load MIDI (our client keeps MIDIServer alive, so RtMidi's own create succeeds); error -> MIDI disabled for this run with a warning, server keeps running. Replaces the subprocess probe.
- 2026-10-04: User decision 2026-10-04: "Yes, auto-recover" — besides the bun:ffi safe check (server never crashes), add the warm-up with retries so MIDI still comes up when start-up hits the MIDIServer shutdown window, without restarting the app. Constraints from CLAUDE.md: any subprocess uses a dedicated CLI flag handled at the top of apps/server/src/index.ts (never process.execPath with Node flags), execFileSync/spawn with an args array and a timeout; must stay safe on Windows/Linux (no-op there if not needed). Before opening the PR, ask the lead for a cross-platform review.
- 2026-10-04: User decision 2026-10-04: "Yes, auto-recover". Besides the safe bun:ffi CoreMIDI probe (server never crashes, MIDI off with a warning on failure), add the warm-up helper subprocess with retries so MIDI comes back by itself in that ~100 ms MIDIServer shutdown window, without restarting the app. Subprocess must follow CLAUDE.md: a dedicated CLI flag handled at the top of apps/server/src/index.ts, execFileSync/array args, never process.execPath with Node flags; works on macOS, Windows, Linux (no-op where not needed).

## PR
- branch:
- pr:
- video:
