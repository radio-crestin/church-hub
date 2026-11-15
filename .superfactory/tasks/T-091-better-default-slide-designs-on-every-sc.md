---
id: T-091
title: Better default slide designs on every screen — professional church look, cross-platform fonts
kind: task
level: normal
order: -1
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T18:14:38.013Z
---

## Goal
User (2026-10-05): «improve the default slides designs on every screen, optimize to showcase the features, use a very good fonts which work across all the operation systems, align things properly like in a big Church professional looking, easy to read and understand».

Done means:
- The default slide designs (songs, Bible verses, announcements and every other content type, on every screen type: main, stage, livestream/NDI, etc.) look like a big, professional church production: clean alignment, consistent margins, good hierarchy, readable from far away.
- Fonts: very good, highly readable fonts that render the same on macOS, Windows and Linux (bundle them with the app, e.g. as webfonts; must support Romanian diacritics ă â î ș ț).
- Defaults showcase the app's features well (e.g. good reference/title placement for verses, song section labels).
- Only the defaults change: users' existing custom designs stay untouched.
- Rendering goes through the shared usePresentationContent hook (CLAUDE.md rule) — no new render engine.
- Before/after screenshots or video for each screen type; e2e spec passing.

## Notes

- 2026-10-05: Video: [T-091.mp4](../tasks_videos/T-091.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/126
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a1eaadc2af7829995/.review-build/T-091/church-hub-T-091.app
- 2026-10-05: Done (2026-10-05). CI: https://github.com/radio-crestin/church-hub/actions/runs/37348968764 (Test green, all PR checks green)
build: https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-macos-arm64-pr-126-f322c63.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-windows-x64-pr-126-f322c63.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-linux-x64-pr-126-f322c63.AppImage
What changed:
- Bundled fonts (fontsource, offline, Romanian diacritics): Fira Sans for text, Montserrat for references, labels and the clock, Lora as a serif option. Added to the picker and the font stacks. Text refits when a web font finishes loading.
- One factory design in app/apps/server/src/service/presentation/default-design/ (a layout table per screen type: primary, stage, livestream, kiosk). Used by new screens, by a fresh install's seed (the fixture now lists screens only) and for missing content types. The old per-type defaults and the adjustForStage/Livestream helpers are removed.
- Existing users: saved designs untouched. Only missing top-level fields fall back to the defaults, as before. Edge case: an old next-slide config with no label or content style gets the new fonts.
- Choices made without asking: the livestream reference now sits on its own gold line instead of inside the verse (marcaje e2e now sets that option itself); stage shows the clock on every content type; kiosk shows a big clock when idle; next-slide label "Urmează:".
How to test: fresh DB or a new screen of each type; present a song (first, middle and last slide), a verse, an announcement and versete tineri. e2e: default-slide-design.spec.ts.
Commits: 053f9e41 55892e0e e7255b1d ad2cf2af c625cb20 f322c63f
Not verified: the real desktop windows on Windows and Linux (only CI smoke and Playwright Chromium + WebKit); NDI output itself.
- 2026-10-05: Resolved by the user. New default designs for the main, stage, livestream and kiosk screens, all from one place (server default-design/). Bundled Fira Sans, Montserrat and Lora; existing screens keep their saved look. PR #126 merged; ran bun install in the main checkout for the new font packages.
- 2026-10-05: User 2026-10-05, after the merge: «make sure the fonts don't have copyright issues». Lead checked: Fira Sans, Montserrat and Lora (Fontsource packages) are all SIL Open Font License 1.1, so they're free to bundle in this app, commercial or not. The one condition: any copy we redistribute must carry each font's copyright notice and the OFL text, and the app doesn't do that yet (no notices file).
Follow-up, done means:
- Each font's copyright notice + OFL-1.1 text is in the repo (one third-party font licences file next to the fonts' registration, or the project's existing licence/notices place if one exists) AND ships inside the built app/installers on all three OSes.
- Confirm the exact copyright holders from the packages' LICENSE files, and that no other new font/asset from T-091 has a different licence.
- Fonts are not sold on their own and keep their names (OFL rules): nothing to change, but confirm.
- PR with CI green.
- 2026-10-05: Font licences follow-up done. PR: https://github.com/radio-crestin/church-hub/pull/129 · CI: https://github.com/radio-crestin/church-hub/actions/runs/37352802809 (all green)
What changed: app/apps/client/public/licenses/third-party-fonts.txt (notices of Fira Sans, Montserrat, Lora + full OFL-1.1 text). Vite copies public/ into dist, which Tauri embeds on all 3 OSes; served at /licenses/third-party-fonts.txt. Pointer comment in bundledFonts.ts. e2e: font-licences.spec.ts (passes locally).
Confirmed: all three packages are OFL-1.1 (from their LICENSE files). Copyright holders: Fira = Mozilla Foundation and Telefonica S.A., RFN "Fira" (the Fontsource LICENSE just says "Google Inc.", so both are listed); Montserrat = The Montserrat Project Authors; Lora = The Lora Project Authors, RFN "Lora". #126 added no other font or asset. Fonts are not sold on their own and keep their names: OFL is met, nothing to change.
Commit: 64b2b95a. No video (nothing to see on screen). Not checked: the file inside an installed build (only seen in dist/ and the CI builds).
- 2026-10-05: Font licence follow-up resolved by the user: third-party-fonts.txt (copyright + OFL-1.1 for Fira Sans, Montserrat, Lora) ships in the client's dist and every installer. PR #129 merged.
