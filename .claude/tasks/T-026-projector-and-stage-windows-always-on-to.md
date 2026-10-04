---
id: T-026
title: Projector and stage windows always on top by default
sprint: 2026-09-28
urgent: true
status: doing
owner: projector
rolled: 0
order: -2
created: 2026-10-04
---
## Goal
Chat 14/06 BCEV: «cred ca ar trb sa fie zindex mai mare la videoproiector slide. (e.g. pusesem o pagina web, iar ce era afisat din Church Hub era sub).» Per-screen alwaysOnTop exists but defaults to false (screens.ts ~710). User 04/10: on by default (new and existing screens).

## Notes
- 2026-10-04 Code done on branch fix/screens-always-on-top (`931cce32`), PR waits for the video helper (T-053). Default flipped server-side: `createScreen` writes `alwaysOnTop !== false`, the seed writes 1 unless the fixture says false, and the one-shot migration `enable-screens-always-on-top` (app_settings key `enable_screens_always_on_top_v1`) switches all existing screens on, once. A screen turned off later stays off. The windows already apply `screen.alwaysOnTop` via Tauri's JS API (openDisplayWindow / ScreenRenderer), so no Rust change and no `cargo check` needed. Column SQL default stays 0 (changing it means rebuilding the table); noted in the schema.
- Tests: `bun test` in server (403 pass, includes the new migration test); `CI=1 TEST_PORT=3126 bunx playwright test e2e/screens-always-on-top.spec.ts e2e/screen-duplicate.spec.ts e2e/multi-screen.spec.ts e2e/screen-editor.spec.ts --workers=1 --retries=2`: 29 passed.
- Risk to flag: on a single monitor, a fullscreen projection window that is always on top can't be covered by the control window (Escape / closing the window still works). Not verified in the desktop app.
- Video note: the shared e2e test DB already ran the migration. Before re-recording the "before" video, reset it: `UPDATE screens SET always_on_top=0; DELETE FROM app_settings WHERE key='enable_screens_always_on_top_v1';`
