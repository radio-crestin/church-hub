---
id: T-057
title: Server sometimes crashes at start-up in CoreMIDI init (macOS, under load)
sprint: 2026-09-28
urgent: false
status: todo
owner:
rolled: 0
order: 1
created: 2026-10-04
---
## Goal
Found by panel-layout while fixing T-056 (2026-10-04): under machine load the server sometimes panics while initializing MIDI on macOS — "MidiInCore::initialize ... (-304)", Bun panic — 2 of 10 loaded e2e runs; it fails fast ("not able to start"). If the bundled app can hit this, Church Hub could fail to start on a busy Mac before a service. Find the root cause (CoreMIDI client creation timing/permissions, native module init on the main thread, etc.) and make MIDI init failure non-fatal (log + retry/disable MIDI) without masking real errors; must stay cross-platform.

## Notes

## PR
- branch:
- pr:
- video:
