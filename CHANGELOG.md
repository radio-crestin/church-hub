# Changelog

> Auto-generated from git history by `app/scripts/generate-changelog.ts`. Do not edit by hand.

## v0.1.91 — 2026-08-23

### 🔧 Changes

- presentation, songs, screens: multi-monitor placement, per-slide styling, stage navigation fixes
- sync version to v0.1.90 [skip ci]

## v0.1.90 — 2026-08-01

### 🚀 Features

- **backup**: restore the database from a local copy, in any folder

### 🐛 Bug Fixes

- **ci**: stop sync-version-back from moving main's version backwards

### 🔧 Changes

- sync version to v0.1.89 [skip ci]
- sync version to v0.1.88 [skip ci]

## v0.1.89 — 2026-08-01

### 🐛 Bug Fixes

- restore the app version to 0.1.88 on main
- **tauri**: register tauri-plugin-os, which three features already called
- **app-update**: make "Check now" actually check, including on a dev instance

## v0.1.88 — 2026-08-01

### 🚀 Features

- **app-update**: a real updates page instead of a pop-up and a link to GitHub

### 🔧 Changes

- sync version to v0.1.87 [skip ci]

## v0.1.87 — 2026-08-01

### 🐛 Bug Fixes

- **scripts**: force LF on shell scripts so release.sh runs under core.autocrlf

### 🔧 Changes

- **app-update**: correct the asset-matching rationale

## v0.1.86 — 2026-08-01

### 🚀 Features

- **app-update**: in-app download and unattended install of new versions
- **songs**: allow the same song more than once in Marcaje and Programe
- **schedules**: preview a song before adding it to a program
- **songs**: reorder a mixed program list, and a real grip on song rows
- **songs**: jump to the Bible when a program's verse row is clicked
- **bible**: collapsible history + the Programe module, listing verses
- **screens**: per-screen "open when the app starts" toggle
- **songs**: Marcaje + Programe side by side on the song list page
- **songs**: drag-to-reorder songs in the Programe panel
- **backup**: local backups to a configurable folder
- **songs**: multi-select Programe modal from the song toolbar
- **songs**: Programe panel in the song page's right column

### 🐛 Bug Fixes

- **songs**: drive list-to-panel drag with pointer events instead of native DnD
- **songs**: make the list-to-panel drop work where custom MIME types are stripped
- **songs**: tell an internal song drag apart from a file arriving from outside
- **backup**: refresh Drive storage after delete, show program contents

### 🔧 Changes

- **schedules**: one large add-item modal with a virtualized song search
- sync version to v0.1.85 [skip ci]

## v0.1.85 — 2026-07-22

### 🐛 Bug Fixes

- **bible**: stop auto-scroll from warping the verse list during user scroll

### 🔧 Changes

- sync version to v0.1.84 [skip ci]
- **bible**: remove unused bookName prop from VersesList

## v0.1.84 — 2026-07-19

### 🔧 Changes

- real-time Google Drive library sync, last-slide layout parity, first-run layout defaults
- sync version to v0.1.83 [skip ci]

## v0.1.83 — 2026-07-16

### 🐛 Bug Fixes

- **backend**: deploy.sh deploys all .prod.vars with validation guard

### 🔧 Changes

- configurable retention, Drive storage quota + warning, and backup contents inspection
- sync version to v0.1.82 [skip ci]

## v0.1.82 — 2026-07-12

### 🐛 Bug Fixes

- **backup**: embed Drive OAuth creds in compile.ts (final sidecar)

### 🔧 Changes

- sung markers, bookmark filter, slide notes + Drive OAuth via worker
- sync version to v0.1.81 [skip ci]

## v0.1.81 — 2026-07-12

### 🔧 Changes

- Google Drive database backup & restore (+ song-editor fixes, release wiring)
- sync version to v0.1.80 [skip ci]

## v0.1.80 — 2026-07-08

### 🔧 Changes

- PowerPoint-style stage editing on the song page
- sync version to v0.1.79 [skip ci]

## v0.1.79 — 2026-06-18

### 🔧 Changes

- Preview mode — stage slides before projecting
- sync version to v0.1.78 [skip ci]

## v0.1.78 — 2026-06-14

### 🚀 Features

- **songs**: discover & import new songs from external sources

### 🐛 Bug Fixes

- **e2e**: update discovery heading selector after screen rename

### 🔧 Changes

- sync version to v0.1.77 [skip ci]

## v0.1.77 — 2026-06-11

### 🚀 Features

- **build**: add tauri:build:release that stamps the latest git tag
- **release-notes**: show per-version release notes in Settings > About
- **songs/search**: remove the result cap — return every match
- **songs/search**: return up to 200 matches instead of 50
- **songs**: wire alphabet fast-scroll into the song list
- **songs**: alphabet fast-scroll rail UI & interaction
- **songs**: alphabet grouping & nearest-letter logic
- **screens**: custom "Amin" text for the song last-slide layout
- **screens**: add "Strofă - Amin" (song_last_slide) last-slide layout
- **screens**: add "Gama - Strofă" (song_first_slide) first-slide layout
- **screens**: configurable song key (gama) + amen elements
- **songs/versions**: pin the opened song first with a Current badge, sort suggestions by score, add empty state
- **songs**: gate the New Song button behind songs.create
- **presentation**: presenter black button hides like Escape (only while live)
- **logs**: colorize log viewer + level filters + search
- **presentation**: presenter-remote (clicker) control
- **songs**: exclude hidden-category songs from version possible-matches
- **songs**: hide/show song categories without deleting them
- **logs**: in-app Logs settings viewer + permissions + richer activity logging

### 🐛 Bug Fixes

- **e2e**: exclude disabled buttons from song-slide selector
- **test**: wait for the real server, not the boot 503, in api.test.ts
- **release**: sync tauri.conf.json to the latest released version
- **screen-editor**: expose songKey in the canvas preview sample
- **songs**: allow song editors to add tags with songs.edit
- **auth**: authenticate desktop via X-User-Auth header (macOS multi-user login/switch)
- **screens**: move a last-slide trailing "amin" line into the amin element
- **screens**: song first/last layouts only when gama/amin present + no transition flash
- **client**: derive API/WS base from the page origin in plain browsers
- **dev**: set VITE_API_PORT in the worktree sample so the client calls port 3002
- **presentation**: only reclaim control-window focus with a second monitor
- **presentation**: keep control-window focus when a screen opens on present
- **auth**: login/switch/logout via context refresh, not page navigation

### 🔧 Changes

- **release-notes**: add changelog generator and generated CHANGELOG
- **songs/search**: restore the 50-result cap
- **songs**: virtualize the browse / search / bookmarks list too
- **songs**: virtualize alphabet fast-scroll for huge libraries
- **skills**: add detailed-pr skill for auto-generated Staff-Engineer PR descriptions
- Change song first and last slide to correct words
- **logs**: full-width search with level filters arranged below it
- **songs**: make category hide/show instant

## v0.1.76 — 2026-06-07

### 🚀 Features

- **search**: consistent clear (X) button that refocuses every search input

### 🐛 Bug Fixes

- **auth**: WebKit drops the Secure session cookie — make attributes engine-aware
- **auth**: surface login-screen failures instead of failing silently
- **dev**: point the worktree dev webview at the configured server port
- **songs**: stop partial saves from wiping keyLine and other metadata

## v0.1.75 — 2026-06-07

### 🐛 Bug Fixes

- **dev**: free the vite port too and detect wildcard-bound listeners

### 🔧 Changes

- gitignore .claude/worktrees so release.sh sees a clean tree
- add empty app/src/index.ts placeholder
- **build**: pin Bun hoisted linker so workspace bins stay in root node_modules/.bin

## v0.1.74 — 2026-06-05

### 🚀 Features

- **errors**: catch + dual-report errors across Rust, server, migrations & client

### 🐛 Bug Fixes

- **e2e**: use localhost (not 127.0.0.1) in CI so the Secure session cookie round-trips
- **auth**: send SameSite=None; Secure for the localhost session cookie
- **startup**: surface boot progress + failures instead of an endless spinner

### 🔧 Changes

- normalize migration SQL line endings to LF

## v0.1.73 — 2026-06-05

### 🚀 Features

- **songs/versions**: add song_versions.view (4th perm) so admins can grant view independently
- **songs/versions**: dedicated song_versions.{create|edit|delete} permissions with backfill migration
- **app-update**: show "dev instance" + suppress update checks in dev

### 🐛 Bug Fixes

- **users/perms**: include song_versions in the picker's GROUP_ORDER so the section actually renders
- **users/perms**: expose song_versions.* in the client permission picker (group + role templates)
- **songs/versions**: widen 'add version' gate to songs.create OR songs.edit on both client and server
- **songs/api**: gate link endpoint on songs.create so add-only operators can link versions
- **songs/versions**: rename to "Versiuni ale cântării", split canAdd (songs.create) from canEdit
- **songs/versions**: make the panel + suggestions readable for view-only users, keep write actions behind songs.edit
- **songs/groups**: self-heal stale 1-member groups + clean up after deleteSong

## v0.1.72 — 2026-06-03

### 🚀 Features

- **presentation**: preview screen + screen-editor updates
- **settings**: route-based settings layout polish
- **songs/layout**: mirror Marcaje divider between songs list and song page
- **songs/versions**: richer suggestions + linked-version rows
- **songs/versions**: match versions by verses, not just title
- **songs/ui**: merge accordion + panel headers, expand slide preview, default widths Slides=30 / Stage=40 / Accordion=30, toast + fade on accept
- **songs/ui**: right column becomes a 2-section accordion (Marcaje + Versiuni) with badge + auto-expand on new suggestions
- **songs/similar**: content-word Jaccard on title + lyrics with Romanian stopwords, kills filler-word false positives
- **songs/ui**: surface similar-song suggestions on the song detail page with accept/dismiss + localStorage dismissals (en + ro + e2e)
- **songs/api**: GET /api/songs/:id/similar — FTS-driven version suggestions with bigram-similarity rerank
- **songs/ui**: SongVersionsPanel + LinkVersionsModal on the song detail page, i18n (en + ro)
- **songs/client**: song-groups service + hooks (useSongGroup, useLinkSongs, useUnlinkSong, useSetPrimarySong)
- **songs/api**: /api/song-groups endpoints (link, set primary, unlink, get) + OpenAPI
- **songs/service**: song-groups service (link/unlink/setPrimary/merge) + Song type
- **songs/db**: add song_groups table and song_group_id column for versions feature

### 🐛 Bug Fixes

- **songs/groups**: map group rows by camelCase keys, not snake_case
- **songs/list**: stop scrollIntoView from re-firing on every infinite-scroll append
- **songs/control-panel**: keep a gap between title and LIVE, truncate long titles with ellipsis

## v0.1.71 — 2026-06-03

### 🚀 Features

- **settings**: restructure settings into route-based pages with persistent divider
- **auth/sidebar**: drop quick-switch, keep only Account + Log out
- **auth/sidebar**: user dropdown with logout & quick switch
- **auth/login**: persisted session auto-signs-in the last user
- **auth/login**: show/hide password toggle + wrong-password feedback

### 🐛 Bug Fixes

- **settings**: redirect /settings index once via effect to stop a render loop
- **auth/sidebar**: size the account dropdown to its content (cap at 320px)
- **auth/sidebar**: render the account dropdown in a portal so it isn't clipped by the sidebar

### 🔧 Changes

- **gitignore**: ignore root-level app/test-results (Playwright run artifacts)

## v0.1.70 — 2026-05-29

### 🚀 Features

- **users**: accounts, permissions, login & account page

## v0.1.69 — 2026-05-21

### 🚀 Features

- **songs**: add multi-assignable audience tags alongside categories
- **presentation/screens**: polish panel layout, rephrase toggle labels, default close-on-escape to OFF

### 🐛 Bug Fixes

- **songs/useDirtyState**: add tagIds to test fixture so dirty-state checks don't crash
- **songs/search**: exact-title queries match + clitic contractions render inside highlight

### 🔧 Changes

- **documented-pr**: Playwright-based skill — HQ recording, cursor overlay, GIF embed
- Presentation window management & sidebar improvements
- Claude Code automations: hooks, subagents, skills

## v0.1.68 — 2026-05-18

### 🔧 Changes

- Release/v0.1.68

## v0.1.67 — 2026-05-18

### 🐛 Bug Fixes

- **live-translation**: exact-match audio meter labels in test

## v0.1.66 — 2026-05-17

### 🚀 Features

- **songs**: wire SongPreviewPage to inline text-mode editing
- **songs**: inline text-mode editing with per-slide Present buttons
- **live-translation/gemini**: text-only via Flash Lite pipeline
- **live-translation**: fill-then-clear two-line transcript on both UIs
- **live-translation**: host transcript shown as per-target teleprompter
- **live-translation/listener**: single-line streaming with pause-based rollover
- **live-translation/listener**: listener can pick text-only vs audio+text
- **live-translation/listener**: big two-line transcript + auto-reload on disconnect
- **live-translation**: settings in a modal + translated text on listener page
- **live-translation**: text-only vs audio+text output modality
- **song-key**: add open-song button to key-line dialog
- **live-translation**: engine selector + multi-target UI, dashboard card, listener language picker
- **live-translation**: add OpenAI Realtime engine + multi-target backend

### 🐛 Bug Fixes

- **schedules**: contain page height so left panel scrolls independently
- **live-translation/gemini**: text-only runs on the audio model
- **live-translation/gemini**: text-only mode connection drop
- **live-translation**: tighten system prompt — literal word-for-word translation
- **live-translation**: use the actual Gemini model ids exposed by the API
- **live-translation**: Gemini engine — current models + server VAD
- **live-translation**: settings modal renders content (was empty)
- **live-translation**: faithful transcription — stop mangling streamed deltas
- **live-translation**: stream translation deltas live to listeners
- **live-translation**: set rate on OpenAI audio.output.format
- **live-translation**: add required session.type to OpenAI session.update
- **song-key**: open-song button navigates in-place, moved to footer
- **live-translation**: migrate OpenAI engine to Realtime API GA schema
- **songs**: preserve titles verbatim; default import title to filename
- **song-key**: stop force-capitalizing every word in key-line editor
- **songs**: allow duplicate titles; identify songs by id
- **churchhub-backend**: guard isAllowedOrigin against undefined ALLOWED_ORIGINS
- **client**: resilient first-startup loading flow
- **seed**: reset keyLine + presentationCount + lastPresentedAt on first seed
- **fts**: rebuild search indexes on every boot, before serve
- **test**: per-attempt AbortController on waitForServer fetch
- **test**: batch seed-songs in a transaction + bind tests to 127.0.0.1
- **test**: stop mirroring sidecar stdout — it stalled the test loop
- **test**: drain compiled sidecar stdout so Windows stops hanging

### 🔧 Changes

- **live-translation/gemini**: lock pipeline to 3.1 models, tighten VAD
- **live-translation**: stop full-state broadcasts on every delta
- **live-translation/listener**: cut first-connect latency
- **deps**: security bump (HIGH-severity dependabot)
- update todos
- **fts**: skip rebuild when source/index row counts already match
- **seed**: batch seed-bibles in a transaction (Windows fix)
- **songs**: align filter button spacing + scrollbar with design
- up

## v0.1.65 — 2026-05-13

### 🚀 Features

- **feedback**: contact details behind a stacked modal
- **feedback**: fold Contact into the Feedback modal
- **feedback**: replace posthog widget with custom send-only modal
- **feedback**: include last 7 days of logs in support tickets
- **feedback**: use PostHog Conversations chat as the feedback UI
- **observability**: fire app_started boot heartbeat from all 3 runtimes
- **feedback**: route to PostHog Conversations + attach server/Tauri logs
- replace Sentry with PostHog + add file logging + open-logs UI

### 🐛 Bug Fixes

- **feedback**: guard markAsRead on no active conversation
- **vite**: pre-bundle posthog-js to avoid mid-boot React duplication
- **feedback**: open ContactModal instantly when conversations isn't ready
- **posthog**: skip init on /screen/* + simplify unread to a pulsing dot
- **csp**: allow PostHog asset domains in script-src
- **feedback**: drop GitHub notice, fall back when conversations is off, remove GTM
- **server**: switch MIDI safety probe to --probe-midi flag

### 🔧 Changes

- **ip**: vendor patched ip package, close GHSA-2p57-rm9w-gvfp
- **security**: patch transitive CVEs (axios, protobufjs, vite, ...)
- **feedback**: outline the Contact us button with a rounded border
- **feedback**: rounded sidebar icon + collapsible contact section
- **sidebar**: align Feedback button with SidebarItem chrome
- **format**: biome auto-fix on feedback + posthog files
- require cross-platform compatibility + release-build smoke tests

## v0.1.63 — 2026-05-02

### 🐛 Bug Fixes

- **server**: defer cfb/codepage loading to keep sidecar boot fast

## v0.1.62 — 2026-05-01

_No notable changes._

## v0.1.61 — 2026-05-01

### 🐛 Bug Fixes

- **client**: use 'localhost' for API host in Tauri desktop
- **server**: bundle cfb + codepage so compiled sidecar can parse PPT
- **bible**: make verse scroll-into-view resilient across chapter cross

## v0.1.60 — 2026-04-07

### 🚀 Features

- bundle sample music file and seed on first run

### 🐛 Bug Fixes

- ensure audify native binary is available after pnpm install
- handle missing audio library gracefully on all platforms
- use window.location.hostname instead of hardcoded 127.0.0.1
- handle missing labelStyle/contentStyle in nextSlideConfig from old DB entries
- use window.fetch instead of tauriFetch on desktop Tauri

### 🔧 Changes

- regenerate fixtures from current database
- regenerate songs fixture from current database
- regenerate fixtures from current database with redacted secrets
- update screen fixtures from backup with proper configs

## v0.1.59 — 2026-04-06

### 🚀 Features

- add macOS Intel (x64) build to release pipeline

### 🐛 Bug Fixes

- use macos-latest for Intel cross-compilation (macos-13 deprecated)
- use 127.0.0.1 instead of localhost in Tauri mode to avoid IPv6 hang
- add timeout to fetcher to prevent infinite loading on API hang

### 🔧 Changes

- update GitHub Actions to latest versions to fix Node.js 20 deprecation

## v0.1.58 — 2026-04-06

### 🚀 Features

- add .ppt file drop support and replace LibreOffice with pure JS parser
- localize chord names based on language (D/Re, C/Do, etc.)

### 🐛 Bug Fixes

- match Romanian locale for debug label in settings e2e test
- use 127.0.0.1 instead of localhost in CI to avoid IPv6 resolution
- serve pre-built client in CI e2e tests instead of proxying to Vite
- increase server startup timeout in API tests for slow CI runners
- use specific song search placeholder and improve settings scroll in CI
- align e2e tests with actual API behavior to fix 25 CI failures
- correct e2e test assertions to match actual API response formats
- add /api/ping route alias for e2e test compatibility
- prevent Bun crash from CoreMIDI initialization failure
- regenerate bun.lock after ppt-to-text dependency addition
- add missing song_bookmarks migration (0024)
- add missing database migrations for screen_scene_overrides and song_bookmark_notes
- skip X32 emulator tests on non-macOS platforms
- make server tests pass in CI without native dependencies
- resolve dependabot security vulnerabilities across all packages

## v0.1.57 — 2026-04-05

### 🚀 Features

- replace mpv with embedded rodio audio player for cross-platform support
- add configurable chord font size in screen settings
- add chord editing for songs with screen display and diagram popup

### 🐛 Bug Fixes

- render chords properly above lyrics on screen with click-to-diagram
- chord diagram z-index above sidebar and dirty state for chords/labels

### 🔧 Changes

- various improvements
- add comprehensive tests for rodio audio player (79 tests)
- add tests
- cleanup

## v0.1.56 — 2026-03-15

### 🐛 Bug Fixes

- handle external links in native page windows (WhatsApp, etc.)
- triple-layer external link handling with debug logging

## v0.1.55 — 2026-03-15

### 🚀 Features

- add granular shortcut settings to Songs and Bible page settings

### 🐛 Bug Fixes

- use on_new_window handler for window.open/target=_blank links
- use location.href redirect instead of IPC for external link interception
- open external links in system browser from custom page webviews
- increase API test timeout to prevent macOS CI failures
- Bible verse list snapping back to searched verse on chapter transition

### 🔧 Changes

- various improvements

## v0.1.54 — 2026-03-08

### 🐛 Bug Fixes

- add error logging to migration runner and getScreenWithConfigs
- handle missing OS plugin in update checker and add window set-icon ACL

## v0.1.53 — 2026-03-08

### 🐛 Bug Fixes

- wrap MIDI device enumeration in checkDeviceStatusAndReconnect

## v0.1.52 — 2026-03-08

### 🐛 Bug Fixes

- gracefully handle missing MIDI subsystem (ALSA) in CI

## v0.1.51 — 2026-03-08

_No notable changes._

## v0.1.50 — 2026-03-08

### 🐛 Bug Fixes

- pre-create draft release before build to avoid permission errors

## v0.1.49 — 2026-03-08

### 🐛 Bug Fixes

- move contents:write permission to workflow level for release creation
- run tests on main push, skip when tag triggers build-release

## v0.1.48 — 2026-03-08

### 🐛 Bug Fixes

- use in-memory fixture DB for bible search tests in CI
- skip bible search tests when DB file is unavailable in CI and trigger tests on tags only

## v0.1.47 — 2026-03-08

### 🔧 Changes

- up
- various bug fixes

## v0.1.46-beta.3 — 2026-03-06

### 🐛 Bug Fixes

- strip non-numeric pre-release from Tauri version for MSI compat

## v0.1.46-beta.2 — 2026-03-06

### 🐛 Bug Fixes

- add retry logic to Bible E2E search for CI FTS index timing

## v0.1.46-beta.1 — 2026-03-06

_No notable changes._

## v0.1.46 — 2026-03-08

### 🐛 Bug Fixes

- strip non-numeric pre-release from Tauri version for MSI compat
- add retry logic to Bible E2E search for CI FTS index timing
- correct E2E test regex for Bible search results in English locale

### 🔧 Changes

- up
- various bug fixes

## v0.1.45 — 2026-03-03

### 🚀 Features

- add bookmarks panel to songs pages
- add global edit mode for song slides with inline editing, reorder, delete, add, and preview editing
- add indigo-themed scrollbars and mobile load buttons for Bible verses
- add OBS scene-based config overrides to screen designer
- add bookmarked songs list with toggle, filter, and full CRUD API
- add inline slide editing from song preview
- add Bible history search, smart add-to-schedule, and queue caching
- add key line to PPTs, edit key line from schedule, last played indicator, and edit-as-text improvements
- add song sorting, duplicate title disambiguation, and mobile search improvements

### 🐛 Bug Fixes

- smooth bookmark drag-and-drop and improve song editor save UX
- constrain songs page layout and add global scrollbar theming
- merge adjacent search highlights into continuous phrases
- prevent restore effect from overriding search result navigation
- improve search scoring so content-only phrase matches rank high
- preserve word boundaries in title sanitization and match hymn numbers with leading zeros
- cap song search score at maximum 100
- handle punctuation in song search query parsing and indexing
- show song list instead of last opened song when returning from another page
- display error in UI when mpv fails to play a file
- kill stale mpv processes on startup to prevent zombie accumulation
- repair concurrency limiter and invalid Drizzle query in music service
- prevent music player crashes by isolating mpv process group
- hide format help when schedule has items, add reference section to Edit as Text
- auto-collapse previous section on navigation, simplify Edit as Text modal
- save button exits edit mode after pending saves complete, add discard button
- improve edit button toggle styling and add discard/save actions
- sync slide edits to preview in real-time and skip animations on content updates
- move Add Slide below slides, open Edit as Text in modal, and polish button colors
- improve edit mode toolbar layout, real-time slide sync, and textarea overflow
- redesign song edit mode with DnD reordering and inline editing in slides panel
- make Bible and Song pages fill viewport height with neutral scrollbars
- resolve 6 bugs - search filters, bible freeze, song navigation, chapter transitions, music player, webview links
- improve music player reliability and add tests
- align song action buttons to left on mobile
- make mobile header scroll with content instead of staying fixed
- revert mobile header to fixed position with proper padding
- use flex-col on mobile layout so header stacks above content
- improve mobile layout for songs pages
- update bun lockfile and embedded migrations for CI
- enhance song search scoring and hymn number lookup
- add content comparison for PPTX import duplicates
- resolve Bible chapter transition sidebar, flicker, and secondary text bugs
- open webview external links in system browser
- prevent content flash during hide animation
- remember search query and scroll position on songs page

### 🔧 Changes

- various improvements

## v0.1.44 — 2026-02-02

_No notable changes._

## v0.1.43 — 2026-03-15

### 🚀 Features

- add granular shortcut settings to Songs and Bible page settings
- add bookmarks panel to songs pages
- add global edit mode for song slides with inline editing, reorder, delete, add, and preview editing
- add indigo-themed scrollbars and mobile load buttons for Bible verses
- add OBS scene-based config overrides to screen designer
- add bookmarked songs list with toggle, filter, and full CRUD API
- add inline slide editing from song preview
- add Bible history search, smart add-to-schedule, and queue caching
- add key line to PPTs, edit key line from schedule, last played indicator, and edit-as-text improvements
- add song sorting, duplicate title disambiguation, and mobile search improvements

### 🐛 Bug Fixes

- increase API test timeout to prevent macOS CI failures
- Bible verse list snapping back to searched verse on chapter transition
- add error logging to migration runner and getScreenWithConfigs
- handle missing OS plugin in update checker and add window set-icon ACL
- wrap MIDI device enumeration in checkDeviceStatusAndReconnect
- gracefully handle missing MIDI subsystem (ALSA) in CI
- pre-create draft release before build to avoid permission errors
- move contents:write permission to workflow level for release creation
- run tests on main push, skip when tag triggers build-release
- use in-memory fixture DB for bible search tests in CI
- skip bible search tests when DB file is unavailable in CI and trigger tests on tags only
- strip non-numeric pre-release from Tauri version for MSI compat
- add retry logic to Bible E2E search for CI FTS index timing
- correct E2E test regex for Bible search results in English locale
- smooth bookmark drag-and-drop and improve song editor save UX
- constrain songs page layout and add global scrollbar theming
- merge adjacent search highlights into continuous phrases
- prevent restore effect from overriding search result navigation
- improve search scoring so content-only phrase matches rank high
- preserve word boundaries in title sanitization and match hymn numbers with leading zeros
- cap song search score at maximum 100
- handle punctuation in song search query parsing and indexing
- show song list instead of last opened song when returning from another page
- display error in UI when mpv fails to play a file
- kill stale mpv processes on startup to prevent zombie accumulation
- repair concurrency limiter and invalid Drizzle query in music service
- prevent music player crashes by isolating mpv process group
- hide format help when schedule has items, add reference section to Edit as Text
- auto-collapse previous section on navigation, simplify Edit as Text modal
- save button exits edit mode after pending saves complete, add discard button
- improve edit button toggle styling and add discard/save actions
- sync slide edits to preview in real-time and skip animations on content updates
- move Add Slide below slides, open Edit as Text in modal, and polish button colors
- improve edit mode toolbar layout, real-time slide sync, and textarea overflow
- redesign song edit mode with DnD reordering and inline editing in slides panel
- make Bible and Song pages fill viewport height with neutral scrollbars
- resolve 6 bugs - search filters, bible freeze, song navigation, chapter transitions, music player, webview links
- improve music player reliability and add tests
- align song action buttons to left on mobile
- make mobile header scroll with content instead of staying fixed
- revert mobile header to fixed position with proper padding
- use flex-col on mobile layout so header stacks above content
- improve mobile layout for songs pages
- update bun lockfile and embedded migrations for CI
- enhance song search scoring and hymn number lookup
- add content comparison for PPTX import duplicates
- resolve Bible chapter transition sidebar, flicker, and secondary text bugs
- open webview external links in system browser
- prevent content flash during hide animation
- remember search query and scroll position on songs page
- install native audio libs in CI and simplify server test jobs
- make audify import lazy so server starts without native audio libs
- increase test timeouts for server and e2e tests

### 🔧 Changes

- various improvements
- up
- various bug fixes
- various improvements
- Update api.test.ts

## v0.1.42 — 2026-02-01

_No notable changes._

## v0.1.41 — 2026-03-15

### 🚀 Features

- add bookmarks panel to songs pages
- add global edit mode for song slides with inline editing, reorder, delete, add, and preview editing
- add indigo-themed scrollbars and mobile load buttons for Bible verses
- add OBS scene-based config overrides to screen designer
- add bookmarked songs list with toggle, filter, and full CRUD API
- add inline slide editing from song preview
- add Bible history search, smart add-to-schedule, and queue caching
- add key line to PPTs, edit key line from schedule, last played indicator, and edit-as-text improvements
- add song sorting, duplicate title disambiguation, and mobile search improvements

### 🐛 Bug Fixes

- Bible verse list snapping back to searched verse on chapter transition
- add error logging to migration runner and getScreenWithConfigs
- handle missing OS plugin in update checker and add window set-icon ACL
- wrap MIDI device enumeration in checkDeviceStatusAndReconnect
- gracefully handle missing MIDI subsystem (ALSA) in CI
- pre-create draft release before build to avoid permission errors
- move contents:write permission to workflow level for release creation
- run tests on main push, skip when tag triggers build-release
- use in-memory fixture DB for bible search tests in CI
- skip bible search tests when DB file is unavailable in CI and trigger tests on tags only
- strip non-numeric pre-release from Tauri version for MSI compat
- add retry logic to Bible E2E search for CI FTS index timing
- correct E2E test regex for Bible search results in English locale
- smooth bookmark drag-and-drop and improve song editor save UX
- constrain songs page layout and add global scrollbar theming
- merge adjacent search highlights into continuous phrases
- prevent restore effect from overriding search result navigation
- improve search scoring so content-only phrase matches rank high
- preserve word boundaries in title sanitization and match hymn numbers with leading zeros
- cap song search score at maximum 100
- handle punctuation in song search query parsing and indexing
- show song list instead of last opened song when returning from another page
- display error in UI when mpv fails to play a file
- kill stale mpv processes on startup to prevent zombie accumulation
- repair concurrency limiter and invalid Drizzle query in music service
- prevent music player crashes by isolating mpv process group
- hide format help when schedule has items, add reference section to Edit as Text
- auto-collapse previous section on navigation, simplify Edit as Text modal
- save button exits edit mode after pending saves complete, add discard button
- improve edit button toggle styling and add discard/save actions
- sync slide edits to preview in real-time and skip animations on content updates
- move Add Slide below slides, open Edit as Text in modal, and polish button colors
- improve edit mode toolbar layout, real-time slide sync, and textarea overflow
- redesign song edit mode with DnD reordering and inline editing in slides panel
- make Bible and Song pages fill viewport height with neutral scrollbars
- resolve 6 bugs - search filters, bible freeze, song navigation, chapter transitions, music player, webview links
- improve music player reliability and add tests
- align song action buttons to left on mobile
- make mobile header scroll with content instead of staying fixed
- revert mobile header to fixed position with proper padding
- use flex-col on mobile layout so header stacks above content
- improve mobile layout for songs pages
- update bun lockfile and embedded migrations for CI
- enhance song search scoring and hymn number lookup
- add content comparison for PPTX import duplicates
- resolve Bible chapter transition sidebar, flicker, and secondary text bugs
- open webview external links in system browser
- prevent content flash during hide animation
- remember search query and scroll position on songs page
- install native audio libs in CI and simplify server test jobs
- make audify import lazy so server starts without native audio libs
- increase test timeouts for server and e2e tests
- display correct broadcast URL after starting livestream

### 🔧 Changes

- various improvements
- up
- various bug fixes
- various improvements
- Update api.test.ts
- fix search
- various improvements
- add livestrean
- fix updates
- various fixes

## v0.1.40 — 2026-01-27

### 🔧 Changes

- fix fixtures
- Update TODO.md

## v0.1.39 — 2026-01-27

### 🔧 Changes

- require tests to pass before build in release workflow
- add testing infrastructure with GitHub Actions CI
- fix fixtures

## v0.1.38 — 2026-01-18

### 🔧 Changes

- various improvements
- various improvements

## v0.1.37 — 2026-01-16

### 🔧 Changes

- various improvements
- various fixes
- various fixes
- trigger Bible manual searches
- fix midi

## v0.1.36 — 2026-01-15

### 🔧 Changes

- fix fixtures

## v0.1.35 — 2026-01-15

### 🔧 Changes

- add error tracking
- up
- Update control-room.png
- update readme.md
- add useful secrets scanners
- invalidate exposed secrets

## v0.1.34 — 2026-01-14

### 🔧 Changes

- Update useSlideAnimation.ts
- various improvements

## v0.1.33 — 2026-01-14

### 🐛 Bug Fixes

- **song-key**: improve mobile responsiveness for dialog and page layout

## v0.1.32 — 2026-01-13

### 🔧 Changes

- various improvements
- up

## v0.1.31 — 2026-01-13

### 🚀 Features

- add page window management and sidebar improvements

### 🔧 Changes

- various improvements
- various improvements
- various improvements
- fix songs sync
- various improvements
- up
- add sample upstash-search

## v0.1.30 — 2026-01-11

### 🐛 Bug Fixes

- ignore legacy shortcut action IDs in validation
- prevent F1-F11 browser interception for keyboard shortcuts

### 🔧 Changes

- up
- up
- fix history click
- fix windows build
- up
- up
- Revert "Merge branch 'main' of https://github.com/radio-crestin/church-hub"
- Revert "up"
- up

## v0.1.29 — 2026-01-11

### 🐛 Bug Fixes

- **music-player**: sync state immediately on play/pause/seek commands

## v0.1.28 — 2026-01-11

### 🐛 Bug Fixes

- **music-player**: improve seeking, volume slider, and state emission

## v0.1.27 — 2026-01-11

### 🔧 Changes

- various improvements

## v0.1.26 — 2026-01-10

### 🐛 Bug Fixes

- **screen-share**: properly close Chrome screen capture when stopped by server

## v0.1.25 — 2026-01-10

### 🚀 Features

- **screen-share**: sync screen share state across all clients
- **presentation**: add WebRTC-based screen sharing to ControlRoom

### 🐛 Bug Fixes

- **screen-share**: add screen_share content type config
- **screen-share**: update presentation state when screen sharing starts/stops
- **screen-share**: prevent isSharing state from being reset on server message

### 🔧 Changes

- up
- various improvements

## v0.1.24 — 2026-01-10

### 🐛 Bug Fixes

- **bible**: prevent input loss during typing by blocking external sync
- **keyboard-shortcuts**: normalize trailing slashes in route comparison
- **keyboard-shortcuts**: focus search without navigation when shortcut pressed on target route
- **keyboard-shortcuts**: preserve page state when navigating to current page via shortcut
- **search**: select all text on click and focus for search inputs
- **bible**: support verse selection and prevent URL sync conflicts in smart search
- **midi-shortcuts**: fix stale closure preventing LED refresh after reconnection
- **bible**: select first search result when pressing Enter with no focused result

### 🔧 Changes

- up
- **bible**: simplify input sync by removing redundant ref tracking

## v0.1.23 — 2026-01-10

### 🚀 Features

- **shortcuts**: disable global shortcuts during shortcut recording
- **midi-shortcuts**: add debugging capabilities to diagnose shortcut issues
- **shortcuts**: support toggle behavior for shared livestream start/stop shortcuts
- **sidebar-config**: add shortcut display in settings cards with color-coded types
- **shortcuts**: restructure shortcuts to per-page/per-feature configuration
- **sidebar-config**: add unified settings modal for all sidebar items
- **presentation**: add deep-linking to schedule items from control room
- **presentation**: add control room settings modal and reorganize presentation configuration
- **songs**: add browser history-based back navigation
- **bible**: implement conditional back navigation based on entry source
- **bible**: add keyboard navigation for search results
- **bible**: redirect sidebar Bible menu to currently displayed verse
- **bible**: add URL-based navigation with shareable links and browser history support
- **bible**: select search result verse without presenting to screen

### 🐛 Bug Fixes

- **shortcuts**: standardize translation variables in conflict messages
- **livestream**: move SceneSettingsPopup inside dialog to fix z-index stacking
- **shortcuts**: align custom page route pattern with sidebar items
- **sidebar-shortcuts**: correct property reference to match BuiltInItemDefinition type
- **presentation**: add schedule context passthrough for deep-linking
- **bible**: focus search input on F5 global shortcut
- **keyboard-shortcuts**: ensure window focuses before search input on F5/F6 shortcuts
- **bible**: restore keyboard navigation when returning to search results from verse view
- **bible**: prevent search input clearing and save last visited verse selection state
- **bible**: prevent debounced URL sync from reverting user input and enforce URL as source of truth
- **bible**: skip verse redirect in sidebar when viewing search results
- **bible**: preserve search query when translation changes
- **bible**: prevent restore-on-open from overriding search results and only select search result verses
- **bible**: prevent infinite loop in URL sync effect by tracking URL changes with ref
- **bible**: restore search context when navigating back from reference search
- **bible**: fix search result selection race condition and restore search context on back navigation
- **bible**: fix race condition in search result selection with atomic state update

### 🔧 Changes

- up
- various improvements
- **migrations**: add migration to clean up legacy keyboard shortcuts
- **midi-shortcuts**: replace legacy searchSong/searchBible with showSlide action
- **keyboard-shortcuts**: unify shortcut configuration
- **presentation**: add full background style to schedule navigation button
- **songs**: align AI search button styling with input field
- **songs**: move AI search button before category filter dropdown
- **ai-search**: extract shared settings feature with per-feature configuration

## v0.1.22 — 2026-01-08

### 🔧 Changes

- **deps**: update bun lockfile

## v0.1.21 — 2026-01-08

### 🚀 Features

- **ui**: extend Combobox to support descriptions and detail badges
- **livestream**: add OBS WebSocket address configuration to setup modal
- **youtube**: enhance template info display with detailed broadcast metadata
- **livestream**: implement YouTube playlist selection
- **songs**: implement fixed header with scrollable song list layout
- **music**: extract audio duration during folder scan for immediate UI display
- **music**: add mpv installation detection and user guidance
- **music**: add server-side audio playback with mpv
- **music**: add music player with folder management and playlist support
- **settings**: integrate AboutSection component into settings page
- **app-update**: add AboutSection component for settings page
- **sidebar**: integrate app-update notification and version display
- **app-update**: add feature module exports
- **app-update**: add UpdateNotification component with dismissal
- **app-update**: add VersionDisplay component for sidebar footer
- **app-update**: add useAppUpdate hook for managing update state
- **app-update**: add version service for checking GitHub releases
- **shortcuts**: add keyboard shortcut indicators throughout application
- **i18n**: add language-specific song suffix ([S] English, [C] Romanian)
- **schedules**: add i18n support for text editor format help
- **presentation**: add scene navigation with OBS integration
- **schedules**: add scene slide rendering support
- **schedules**: integrate ScenePickerModal with scene selection in presenter
- **schedules**: add scene selection handler to AddToScheduleMenu
- **obs-export**: add obs_scene_name column to schedule_items table
- **schedules**: add scene (SC) element type support
- **obs-export**: add health check with automatic reconnection on server disconnections
- **presentation**: add server URL selector to OBS export modal
- **presentation**: add OBS screen export functionality for Browser Source
- **bible**: enable keyboard shortcuts at chapters level with level-aware controls
- **bible**: update ESC key behavior based on presentation state
- **presentation**: add clear highlights button and auto-clear on slide change
- **presentation**: add text highlighting with live styling and WebSocket sync
- **ai-search**: add configurable toggle for result analysis
- **ai-search**: improve relevance with expanded term generation and detailed result scoring
- **bible**: add AI-enhanced search for Bible verses
- **ai-search**: add AI-powered result scoring and relevance filtering
- **songs**: add AI search types, services, hooks, and UI components
- **api**: add songs AI search endpoint with OpenAPI docs
- **songs**: add AI-powered semantic search service
- **bible**: add debounce to Bible text search with pending indicator
- **songs**: navigate to song view after saving instead of edit page
- **keyboard-shortcuts**: redirect song detail pages to list on search shortcut
- **database**: dynamically detect configuration tables during selective import
- **database**: add selective import to allow importing specific data categories
- **keyboard-shortcuts**: add search reset functionality to song and bible shortcuts

### 🐛 Bug Fixes

- **livestream**: remove unused isCheckingConnection state variable
- **mixer**: use consistent Settings label for connection button
- **songs**: add thin scrollbar with margin positioning to keep items aligned
- **app-layout**: use overflow-y-auto for flexible scroll behavior
- **app-layout**: re-enable page scrolling with custom scrollbar styling
- **music**: center player controls with balanced placeholder div
- **music**: hide duplicate slider value in progress bar
- **slider**: format values with Math.round and add formatValue prop
- **music**: use eq helper for WHERE clause in getFolderById
- **music**: initialize volume to 0 on app startup
- **music**: display queue/playlist in music player panel
- **music**: align types and hook API for music player integration
- **music**: use native Tailwind classes instead of shadcn-ui components
- **music**: replace ScrollArea with native overflow scrolling
- **music**: correct SQLite foreign key syntax in migration
- **livestream**: display only keyboard shortcuts in StreamControls
- **app-update**: fetch all releases instead of latest endpoint
- **ui**: prevent dialog closure when dragging selected text outside
- **schedules**: prevent dialog closure when dragging selected text
- **schedules**: auto-expand scene items when navigating to them
- **i18n**: remove OBS prefix from scene label
- **schedules**: display scene name in SceneSlide component
- **schedules**: show scene selection highlighting by matching obsSceneName
- **presentation**: render combobox dropdown inside dialog portal to fix z-index stacking
- **obs-export**: remove visible connection status indicator and handle reconnection silently
- **keyboard-shortcuts**: stop event propagation when keyboard handler is triggered
- **presentation**: move useMemo before early return to maintain hooks order
- **presentation**: use useSlideHighlights hook for real-time highlight rendering
- **presentation**: pass styleRanges to AnimatedText in verse rendering
- **presentation**: fix schedule slide advancement auto-clear with stable state dependencies
- **presentation**: fix auto-clear highlights and add clear button to control panels
- **presentation**: add React.memo to AnimatedText and staleTime to queries
- **presentation**: remove redundant useWebSocket call causing re-renders
- **presentation**: prevent re-renders during text selection by using refs
- **presentation**: debounce text selection to prevent re-render interruption
- **presentation**: skip hidden elements when calculating text selection position
- **presentation**: pass styleRanges to ScreenContent and wrap styled content in span
- **ai-search**: increase search limit to 150 candidates for AI analysis
- **livestream**: wait for config to load before auto-opening setup modal
- **songs**: deselect song and select all search text on input click
- **presentation**: preserve separate lines for slides with 2 or fewer lines
- **songs**: enable navigating back to search input via arrow up
- **keyboard-shortcuts**: prevent auto-navigation when opening song search via shortcut
- **database**: improve error handling and remove readonly mode for source db
- **database**: export selectiveImportDatabase and ImportOptions from index
- **midi**: reset all LED states on device connection for Windows compatibility
- **database**: safely handle checkpoint when source database is readonly during import
- **database**: replace serialize with streaming file copy to prevent OOM errors

### 🔧 Changes

- various improvements
- **livestream**: reorder connection menus to show settings first with gear icon
- various improvements
- **music**: reorganize player layout with volume control in page header
- **settings**: consolidate page spacing with bottom padding
- **app-update**: add margin bottom to AboutSection component
- **settings**: move AboutSection to bottom of page
- **migrations**: standardize embedded migration object formatting
- **tasks**: mark completed development tasks
- **build**: add churchhub.db to gitignore
- **app-update**: add About section translations
- **sidebar**: remove VersionDisplay and reorder UpdateNotification
- **sidebar**: add version-related translations for English and Romanian
- **i18n**: move format descriptions to comment lines
- fix midi controller
- **schedules**: update schedule text format to suffix style
- **presentation**: restructure export modal header layout
- **presentation**: simplify server URL selection with unified dropdown
- Update TODO.md
- Update TODO.md
- **presentation**: move auto-clear highlights to global AppLayout
- add db.sqlite to gitignore
- **database**: add slide_highlights migration for presentation_state table
- **presentation**: remove unnecessary padding from mark element styling
- **presentation**: improve preview layout and remove unused quick links
- **ai-bible-search**: reduce context size with compact verse format
- **ai-search**: optimize songs analyzer by filtering to relevant lyrics only
- **songs,settings**: add translations for AI search feature
- **livestream**: replace native select with Combobox for stream key selection
- **songs**: reduce search debounce from 1500ms to 600ms for faster feedback
- Revert "refactor(schedules): remove empty slide button UI from presenter"
- **schedules**: remove empty slide button UI from presenter

## v0.1.20 — 2026-01-06

### 🐛 Bug Fixes

- **midi**: broadcast presentation state when shortcuts navigate
- **midi**: add server-side debouncing for note_on and control_change events
- **keyboard-shortcuts**: use working endpoint for next/previous slide navigation

### 🔧 Changes

- Update TODO.md
- **midi**: centralize shortcut handling on server and remove client round-trip

## v0.1.19 — 2026-01-06

### 🚀 Features

- **migrations**: add song titles migration with ASCII extraction from verse content
- **songs**: sort by presentation count descending when browsing
- **songs**: add infinite scroll with preloading to song list
- **songs**: add category filter dropdown to songs page
- **presentation**: improve versete tineri preview with simplified names and 1.5x font scaling
- **presentation**: highlight versete_tineri sections with green background
- **presentation**: add colored background to next slide content type icons
- **presentation**: add content type icon to next slide section
- **presentation**: use configured line separators from screen settings
- **presentation**: enhance next slide preview display with labels and compression
- **presentation**: pass label and title to next slide data in renderer
- **schedules**: populate label and title in next item preview
- **presentation**: add label and title fields to next slide preview types
- **presentation**: display next schedule item in preview when at last slide
- **schedules**: add getNextItemPreview helper and integrate with handlers
- **presentation**: pass nextItemPreview through presentation state functions
- **presentation**: add NextItemPreview interface to client types
- **presentation**: add NextItemPreview interface to server types
- **schedules**: add verse validation feedback when items are skipped
- **schedules**: add validation error display and optimize EditAsTextModal
- **schedules**: add inline validation warning icons for invalid references
- **schedules**: add Bible passage update support on PUT API endpoint
- **bible**: add verse validation to passage parser
- **schedules**: collapse schedule items by default
- **sidebar**: persist collapsed state to localStorage
- **schedules**: reopen add menu on sub-modal close and collapse sidebar by default
- **schedules**: add edit mode for schedule items with song replacement and passage updates
- **schedules**: add context menu and warning indicators for schedule items
- **songs**: preserve selected song when navigating back from detail page
- **songs**: add ESC to go back when no slide is presented
- **songs**: add keyboard navigation for slide selection on detail page
- **songs**: add keyboard navigation for search results
- **songs**: preserve search query when navigating from song detail page
- **schedules**: allow navigating next on last slide to hide presentation
- **schedules**: highlight presented items with green border and ring
- **presentation**: add support for presenting announcements, Bible passages, and Versete Tineri
- **navigation**: add last visited page tracking for songs, bible, and schedules
- **navigation**: track last visited song in navigation history
- **schedules**: auto-expand items when presenting slides
- **schedules**: add edit button, drag reorder, and expand/collapse controls to schedule items panel
- **schedule-editor**: add import button and confirmation dialog
- **schedule-export**: add hooks for loading and importing schedule files
- **schedule-export**: add types and utilities for schedule import
- **schedules**: implement two-panel presenter with draggable divider
- **midi**: implement device ID sync on reconnection
- **midi-ui**: display reconnection status in device selector
- **midi-hook**: subscribe to device reconnection events to refresh LED feedback
- **midi-context**: add reconnection state and event subscription system
- **midi-routes**: enable auto-reconnection on device connection failure
- **server-main**: wire up MIDI connection status callback for WebSocket broadcast
- **websocket-types**: add reconnection status fields to MIDI connection event
- **midi-service**: add device reconnection monitoring and recovery logic
- **database-export**: add timestamp to database backup filename
- **bible-history**: implement upsert logic to prevent duplicate verse entries
- **bible**: add verse history tracking with persistent storage
- **bible**: restructure history panel to right side with collapsible toggle
- **bible**: integrate history panel into Bible page with persistent layout
- **bible**: add client-side history types, hooks, and components
- **bible**: add server-side history service and API endpoints
- **songs**: simplify duplicate handling with single replace option
- **songs**: improve duplicate song modal with clearer options
- **songs**: handle duplicate song title on save with user options

### 🐛 Bug Fixes

- **midi**: prevent reconnection loops in MIDIContext useEffect
- **websocket**: prevent reconnection loops by fixing useEffect dependencies
- **websocket**: add stale connection cleanup with activity tracking
- **obs**: handle scene automation when disconnected and sync Church Hub as source of truth
- **db**: rebuild search index after song titles migration
- **migrations**: replace duplicate song titles instead of skipping conflicts
- **presentation**: count song presentations by session instead of per slide
- **songs**: use drizzle query builder for pagination to ensure proper column casing
- **songs**: set category dropdown width to longest option name
- **categories**: set default priority to 1 for new categories
- **song-import**: remove special characters from extracted song titles
- **presentation**: hide next slide section when no next slide data exists
- **schedules**: update versete tineri preview format to use parentheses with commas
- **text-content**: apply line compression synchronously in useMemo
- **presentation**: lower next slide icon position slightly
- **presentation**: add right margin to next slide icon for better spacing
- **presentation**: use dash separator for song title in next slide label
- **presentation**: adjust next slide label formatting to add colons only when title exists
- **presentation**: improve next slide preview to include verse text and preserve line breaks
- **schedules**: validate verse existence before processing schedule items
- **schedules**: improve auto-scroll to find previous slide and position it at container top
- **versete-tineri**: persist updates to database when editing schedule entries
- **schedules**: prevent infinite re-render loop in InsertSlideModal
- **versete-tieri**: prevent infinite re-render and add verse validation
- **bible-picker**: resolve infinite re-render loop and add verse validation
- **schedules**: properly handle song replacement for first item position
- **schedules**: maintain song position when replacing via change song
- **songs**: always pass fromSong=true to prevent auto-redirect on back navigation
- **schedules**: replace manual scroll with scrollIntoView for reliable auto-scroll
- **presentation**: render announcement, bible_passage, and versete_tineri on projected screen
- **schedules**: use schedule-aware navigation to prevent clearing presentation
- **schedules**: move keyboard shortcuts useEffect after handler definitions
- **schedules**: add missing slide handler dependencies to keyboard shortcuts effect
- **songs**: clear lastVisited when navigating back from song detail
- **schedules**: clear lastVisited when navigating back from schedule detail
- **schedules**: synchronize navigation handlers for seamless boundary transitions
- **keyboard-shortcuts**: enable global navigation shortcuts in app layout
- **obs**: remove queue dependency from content-type-detector
- **midi**: prevent double-trigger by implementing removeAllListeners and defensive disconnect
- **midi**: eliminate duplicate triggers from nested providers and deduplication
- **bible**: replace space-y with flexbox gap for consistent history item spacing
- **keyboard-shortcuts**: sync across clients and handle mutation errors properly
- **bible**: prioritize history item navigation in verse scroll
- **bible**: use double requestAnimationFrame to ensure scroll on history item click
- **bible**: make history item clicks behave like search
- **bible-history**: reorder history by oldest first
- **songs**: resolve UNIQUE constraint error in song replacement
- **songs**: check duplicate title for both new and updated songs
- **songs**: prevent event object from being passed to handleSave

### 🔧 Changes

- **keyboard-shortcuts**: consolidate listeners with priority-based handler routing
- **songs**: remove debug console.log statements from SongCard
- **keyboard-shortcuts**: implement priority-based keyboard navigation system
- up
- various improvements
- **categories**: optimize upsert with single-query approach using RETURNING
- **presentation**: add background colors for all content types in next slide section
- **versete-tineri**: display name with reference in parentheses format
- update TODO list with completed items
- **schedules**: position selected slide as second item from top for better context
- update TODO list with completed items
- **schedules**: batch insert Bible verses and VT entries in replaceScheduleItems
- **bible**: add invalid_verse error message for schedule translations
- **schedules**: consolidate edit functionality into presenter and simplify editor
- **core**: remove orphaned components and fix MIDI provider setup
- **songs**: remove presentationQueue references from replaceSongReferences
- **schedules**: add translations for schedule import feature
- **presentation**: complete phase 2 queue removal plan
- **queue**: remove entire queue system from client and server
- **schedules**: remove import-to-queue feature
- **bible**: remove numbered indices and padding from history items
- **project**: update TODO items and remove unused constant
- **project**: update TODO items for completed and in-progress tasks
- **project**: update TODO items for completed and in-progress tasks
- **midi**: add translations for MIDI device reconnection messages
- Update TODO.md

## v0.1.18 — 2026-01-04

### 🚀 Features

- **i18n**: add translations for kiosk debug and Bible download/import sections
- **shortcuts**: add next/prev slide navigation shortcuts
- **kiosk**: blank screen immediately after 5 server disconnects on mobile
- **kiosk**: add clickable disconnection indicator with server reconnection modal on iOS

### 🐛 Bug Fixes

- **keyboard-shortcuts**: merge saved config with defaults to ensure new actions exist
- **shortcuts**: prevent Tauri API errors in browser and HMR contexts
- **midi-led-feedback**: refresh LED states after MIDI events to override hardware toggle
- **clock**: prevent drift by syncing updates to second boundaries
- **presentation**: ensure clock updates reliably every second
- **kiosk**: keep disconnection message visible during reconnection attempts
- **kiosk**: correct reconnection logic to check overlay visibility instead of status history
- **api-url**: support dash characters in mobile auth token regex
- **loading-screen**: improve mobile responsiveness and multiline log display

### 🔧 Changes

- various improvements
- fix yt live
- Update TODO.md
- Update embedded.ts
- Update TODO.md
- up
- **kiosk**: improve logging clarity for screen blank and restore flow
- various improvements

## v0.1.17 — 2026-01-01

### 🚀 Features

- **openapi**: use dynamic server url based on request host in api spec
- **api**: add Amin! and expanded presentation order to song responses
- **song-export**: add Amin! to the last slide in exports
- **song-export**: apply dynamic chorus insertion to PPTX and OpenSong exports
- **songs**: add dynamic chorus insertion between verses
- **songs**: add dynamic chorus insertion at render time
- **songs**: add automatic presentation order generation for song imports
- **presentation**: add disconnect detection with automatic content hiding

### 🐛 Bug Fixes

- **songs**: preserve original slide order when inserting choruses between verses
- **presentation**: use transparent background during loading and error states
- **presentation**: increment missedPongs on WebSocket connection errors
- **keyboard-shortcuts**: ensure MIDI shortcuts capture when recording

### 🔧 Changes

- Update TODO.md
- various fixes
- Update TODO.md
- Update TODO.md
- Update TODO.md

## v0.1.16 — 2025-12-31

### 🚀 Features

- update Bible translations, song fixtures, and UI improvements
- **database-management**: add FTS rebuild button in settings and trigger rebuild after factory reset
- **songs**: add FTS search index rebuild endpoint and automatic rebuild after batch import
- **songs**: add song count display to category cards

### 🐛 Bug Fixes

- **songs**: preserve numbers in sanitized titles for searchability
- **songs**: remove duplicate server-side title sanitization
- **song-import**: preserve numbers in imported song titles when not using first verse
- **categories**: add proper pluralization and display priority with song count
- **combobox**: display dropdown correctly in modal dialogs
- **songs**: set navigation flag when returning from presented song

### 🔧 Changes

- add multiple Bible translations
- fix font sizes
- Add multiple translations
- fix Bible navigation
- remove .idea folder from git and fully ignore it
- fix content
- various improvements
- various improvements
- various improvements
- improve import functionalities

## v0.1.15 — 2025-12-30

### 🚀 Features

- **tauri**: bundle MIDI native module for production builds
- **api**: add optional parameters to factory reset endpoint

### 🐛 Bug Fixes

- **server**: migrate seed fixtures to static imports and fix async loading

## v0.1.14 — 2025-12-30

_No notable changes._

## v0.1.13 — 2025-12-30

### 🐛 Bug Fixes

- **core**: make Emitter import conditional on macOS
- **windows**: prefix NSIS macros to avoid conflicts with Tauri's built-in macros
- **tauri**: guard macOS-specific RunEvent::Opened variant with platform check

### 🔧 Changes

- **deps**: regenerate lock file to fix frozen-lockfile CI builds

## v0.1.12 — 2025-12-30

### 🚀 Features

- **presentation**: add bounds clamping for clock elements to prevent screen overflow
- **contact**: add back navigation to feedback modal
- **sidebar**: integrate feedback button and modals with contact option
- **api**: add feedback proxy endpoint and OpenAPI documentation
- **i18n**: add feedback and contact translations for English and Romanian
- **feedback**: add FeedbackModal and ContactModal components with service
- **presentation**: add slide transition animation for navigating between slides
- **presentation**: implement synchronized animation system with content-aware lifecycle
- **screen-editor**: add animation configuration UI support for referenceText and personLabel elements with backwards compatibility
- **presentation**: add animation support for reference text and person label elements
- **songs**: add uncategorized songs management and bulk delete endpoints
- **songs**: integrate uncategorized songs in CategoryManager
- **songs**: add UncategorizedSongsCard component
- **song-import**: add smart duplicate detection with content comparison
- **song-import**: add Tauri onDragDropEvent support for desktop drag and drop
- **song-import**: add duplicate song detection and handling dialog
- **tauri**: add custom file association icons for macOS and Windows
- **livestream**: add custom scene creation and scene switching when OBS disconnected
- **livestream**: add confirmation dialog when canceling stream start
- **schedules**: make pages mobile responsive with icon-only buttons and tooltips
- **controls**: enhance navigation buttons with larger tap targets and consistent icons
- **song-import**: add server proxy endpoint for CORS bypass downloads
- **song-import**: add skipManuallyEdited option to prevent overwriting user edits
- **presentation**: add always on top window control with text labels and translations
- **song-export**: add multi-format support with parallel batch processing
- **song-export**: add format selection UI to export options modal
- **song-export**: refactor export into zip and folder methods
- **presentation**: add always-on-top toggle for display windows
- **schedules**: integrate export format selector into schedule editor
- **schedule-export**: add multi-format support with browser fallback
- **schedule-export**: create format selection modal component
- **schedule-export**: add ZIP generation utility for PPTX archives
- **config**: make server and Vite ports configurable via environment variables
- **song-export**: add PPTX export format with browser fallback
- **schedules**: add dedicated EditVerseteTineriModal for versete tineri editing
- **song-export**: add PPTX export format option alongside OpenSong XML

### 🐛 Bug Fixes

- **presentation**: ensure pure black background during loading for screen routes
- **clock**: persist clock configuration to global settings instead of content config
- **presentation**: sync clock display across all slide types
- **feedback**: add missing isTauri check for browser compatibility
- **presentation**: refine animation defaults for consistent synchronization
- **song-import**: ensure song titles are sanitized during batch imports and filename fallbacks
- **songs**: invalidate songs query when deleting category
- **presentation**: add line break before Amin text on last slide
- **presentation**: simplify Amin addition by removing extra empty paragraphs
- **presentation**: remove trailing empty paragraphs before adding Amin text
- **livestream**: show broadcast info based on livestream status instead of OBS connection
- **livestream**: add setCurrentScene method to OBSWebSocketClient
- **livestream**: prevent custom scenes from disappearing when OBS is connected
- **livestream**: use isLive instead of isStreaming for button state
- **livestream**: check OBS connection status before scene switches and streaming
- **server**: include alwaysOnTop in screen service and types
- **schedule-export**: use same text format as Edit as Text modal
- **schedules**: prevent repeated API requests in auto-save by tracking saved state
- **schedules**: hide template selector when editing announcement slides
- **schedules**: hide template selector when editing versete tineri
- **schedules**: enable versete tineri entry editing in InsertSlideModal
- **schedules**: handle bible_passage and versete tineri entries in EditAsTextModal

### 🔧 Changes

- add new fixtures
- improve the animations
- **presentation**: migrate clock config from nested object to boolean flag for cleaner per-content settings
- **presentation**: per-slide-type clock enable with shared config
- **feedback**: add border to contact button
- **sidebar**: reorder feedback below divider
- **sidebar**: move feedback above divider
- **sidebar**: move feedback button above settings with divider
- update configuration for churchhub-backend migration
- **backend**: rename youtube-oauth-worker to churchhub-backend with feedback support
- fix Bible
- add animations
- **presentation**: implement sophisticated animation system with content-aware lifecycle
- **songs**: add uncategorized songs translations
- up
- Update README.md
- add README.md
- up
- fix
- add Amin
- allow switching the scenes without obs being connected
- **livestream**: move pulsing live indicator to right side of stop stream button
- **controls**: hide button labels on mobile, show on desktop
- **controls**: align preview to top with buttons directly below
- **song-import**: optimize batch import with larger chunk sizes and preloaded lookups
- **song-import**: add performance logging to search index updates
- skip importing manually modified songs
- always on top
- **presentation**: use variant-based styling for always-on-top button
- **song-export**: add translations for export format options
- **schedules**: add translations for schedule export formats
- **db**: format migration journal with consistent quotes
- **schedules**: add staleTime to prevent constant refetching
- various improvements

## v0.1.11 — 2025-12-29

### 🚀 Features

- **schedules**: use VerseteTineriEditor for versete tineri slides
- **schedules**: add Bible passage picker to schedule editor
- **schedules**: add VT: prefix support for versete tineri in text editor
- **schedules**: add text-based schedule editing with song resolution
- **tauri**: enable DevTools in production with keyboard shortcuts for zoom and DevTools toggle
- **songs**: optimize search with debounce, request cancellation, and immediate trigger

### 🐛 Bug Fixes

- **kiosk**: use uniform scaling for clock to maintain aspect ratio and correct positioning
- **presentation**: ensure clock renders consistently with editor preview using TextContent component
- **clock**: align clock vertically based on style configuration
- **clock**: apply dynamic alignment to clock element based on style configuration

### 🔧 Changes

- Update TODO.md
- various improvements
- **ui**: extract shared AddMenuModal component for queue and schedule menus
- **schedules**: align add button styling with edit as text button
- **schedules**: move edit as text button to items section
- import-export programs
- import-export songs
- Update embedded.ts
- **db**: optimize SQLite with RAM settings and compound indexing
- Update embedded.ts
- **project**: add task for fixing clock position alignment
- **server**: format embedded migrations file with consistent quote style
- **kiosk**: simplify wake lock manager to always enable screen wake lock
- various improvements
- **lint**: fix formatting and import ordering issues

## v0.1.10 — 2025-12-28

### 🚀 Features

- **debug**: add debug mode toggle in settings with global WebSocket panel
- **layout**: implement mobile fullscreen display with safe area handling

### 🐛 Bug Fixes

- **presentation**: add debug info update in Tauri WebSocket path for iOS URL display
- **presentation**: fix slide navigation race condition with millisecond timestamps
- **presentation**: convert updatedAt to number for proper serialization
- **presentation**: serialize navigation requests to prevent race conditions
- **presentation**: unify HTTP and WebSocket state ordering with updatedAt
- **presentation**: ensure LivePreview re-renders when temporary content changes
- **presentation**: prevent timestamp collision race condition in slide navigation
- **presentation**: add timestamp validation to prevent stale cache updates
- **presentation**: add timestamp validation to prevent slide navigation race condition

### 🔧 Changes

- various improvements

## v0.1.9 — 2025-12-28

### 🔧 Changes

- update bun lockfile
- up
- remove tauri/gen from git and add to gitignore

## v0.1.8 — 2025-12-28

### 🚀 Features

- **bible**: auto-navigate to next chapter when verses finish
- **pages**: add connection error detection and display connection lost page
- **presentation**: implement 3-strike ping/pong mechanism for WebSocket health check
- **kiosk**: show disconnection message in bottom left corner
- **kiosk**: add 1-minute delay before screen dim and fullscreen support
- **kiosk**: add screen-brightness plugin permissions to capabilities
- **kiosk**: add native iOS screen brightness control via custom Tauri plugin
- **kiosk**: add debug button to test screen dim overlay
- **kiosk**: add screen dim on WebSocket disconnect
- **presentation**: add open song/bible button to control room header
- **kiosk**: add screen wake lock support to prevent screen from turning off
- **presentation**: restrict fullscreen mode to native display windows only
- **screen-editor**: enable screen dimension customization in editor
- **presentation**: add touch support for toolbar visibility in fullscreen mode
- **kiosk**: migrate settings storage from database to localStorage
- **screen-editor**: implement StyledText component with full TextStyle support
- **screen-editor**: add full text style options to next slide section
- **screen-editor**: add missing text style options (minFontSize, lineHeight, shadow)
- **database**: add import functionality with validation and backup
- **settings**: add database management with info and export functionality
- **bible**: add auto-navigation and sync with temporary Bible content
- **songs**: add auto-navigation to presented song on page open
- **presentation**: add skipTaskbar option to hide display windows from dock
- **songs**: add "Add to Schedule" button to song preview page header
- **songs**: update preview header with back button and song title
- **songs**: move edit button to header row with purple styling
- **presentation**: add temporary content support to LivePreview component
- **presentation**: add temporary content presentation mechanism
- **presentation**: use screen name in window titles instead of display ID
- **songs**: add placeholder to Musical Key input field
- **combobox**: add React Portal support to dropdown rendering
- **presentation**: add fullscreen controls and auto-maximize handling
- **build**: add embedded migrations and server startup health checks
- **system-token**: add system token management UI with localhost-only API routes
- **settings**: add API documentation link in settings page
- **auth**: add system token API for external app access
- **livestream**: add tooltip component and improve BroadcastInfo UI
- **keyboard-shortcuts**: integrate MIDI device selector into settings UI
- **keyboard-shortcuts**: allow startLive/stopLive to share the same shortcut
- **keyboard-shortcuts**: add recording context and MIDI shortcut support
- **livestream**: return re-auth status in YouTube auth check
- **livestream**: show toast notification when YouTube session expires
- **livestream**: add YouTube OAuth error handling with re-auth detection
- **livestream**: add stream start/stop scene configuration
- **livestream**: add YouTube broadcast readiness check with progress tracking
- **livestream**: refactor scene management with settings modal and drag-and-drop reordering
- **livestream**: enable auto-reconnect for manual OBS connections
- **livestream**: always initialize OBS auto-reconnect at startup
- **livestream**: add OBS WebSocket auto-reconnect with exponential backoff
- **livestream**: wire up OBS callbacks for real-time scene updates
- **presentation**: display next Bible verse as preview
- **api**: add GET /api/bible/next-verse endpoint
- **bible**: add getNextBook and getNextVerse service functions
- **presentation**: add comprehensive next slide preview for all content types
- **bibles**: export and seed books and verses in Bible fixtures
- **db**: add seeding for songs, bibles, categories, and settings on startup
- **db**: add automatic seeding of default screens on app installation
- **presentation**: add visibleWhenHidden property to control element visibility in hidden mode
- **presentation**: add title and content style configuration for next slide element
- **presentation**: integrate batch update API in screen manager for atomic saves
- **presentation**: add batch update API endpoint for atomic screen config saves
- **screen-preview**: add background styling to preview container
- **constraint-controls**: add unit conversion and improve constraint UI
- **presentation**: add value indicators with units to constraint anchor points
- **presentation**: auto-open active screens on startup
- **webview**: upgrade Chrome user agent and improve video playback performance
- **bible**: separate verse selection from presentation
- **bible**: implement interactive 3-panel presentation UI with navigation, queue, and controls
- **db**: implement modular migration engine with version tracking
- **song-import**: standardize song title sanitization across client and server
- **songs**: add source file path display to song editor UI
- **song-import**: extract title from first slide and clean non-alphanumeric characters
- **server**: add token-based user authentication endpoint
- **server**: validate permissions on protected API endpoints
- **client**: protect routes with permission guards
- **i18n**: add permission error messages for access denied pages
- **ui**: create PagePermissionGuard component for route protection
- **song-export**: add complete import/export feature with OpenSong XML support
- **song-import**: add support for PPT files in ZIP archives with server-side conversion
- **song-import**: add PPT to PPTX conversion support with LibreOffice
- **search**: enhance relevance with fuzzy highlighting, rarity boost, and noise filtering
- **search**: add diacritic-insensitive highlighting with word boundary matching
- **search**: enhance fuzzy match highlighting with extended candidate pool
- **ui/categories**: add CategoryManager component with drag-drop sorting
- **api**: add category reorder endpoint and integrate priority into search
- **categories**: add priority field to song categories
- **search**: add trigram fuzzy search for substring matching
- **song-import**: add import options for title extraction and duplicate handling
- **songs**: improve search ranking with field-weighted scoring and tiered query matching
- **songs**: add error modal when no valid songs found during file import
- **songs**: add search persistence and limit song list to 50 rows
- **song-import**: add progress indicator and increase batch size to 200
- **song-import**: add batch import with progress tracking and OpenSong support
- **sidebar**: make sidebar mobile-responsive with hamburger menu and drawer
- **pptx-import**: directly create songs on PPTX import without dialog
- **songs**: add PPTX import button with file dialog integration
- **pptx-import**: add PPTX file import with file association and drag-drop
- **presentation**: add dynamic preview border with display state indicator
- **presentation**: enhance control room with status indicator and immediate preview
- **queue**: add menu options for inserting songs and slides at specific positions
- **queue**: make song titles clickable to select first slide
- **queue**: add editing support for standalone slides
- **queue**: add song editing and slide insertion to control room
- **sidebar**: rename present feature to control room and update icon
- **presentations-programs**: implement comprehensive programs and presentation management system
- **routes/songs**: add dedicated songs management page
- **routes/settings**: add authorized devices section to settings page
- **client/devices**: implement device management UI and hooks
- **server**: integrate device authentication endpoints and middleware
- **openapi**: add OpenAPI specification and Scalar documentation
- **middleware**: add device authentication and permission validation
- **service/devices**: implement device CRUD and token management service
- **db**: add device and device permissions database schema
- **songs**: add editor component, management hooks, and toast/modal UI utilities
- **ui**: add reusable modal and toast components
- **routing**: restructure app routes and add toast provider to layout
- **ui**: update sidebar navigation to include songs and schedules
- **i18n**: add common button labels and presentation namespace
- **presentation**: add presentation mode feature for schedules
- **schedules**: implement schedule editor with drag-and-drop reordering
- **i18n**: add schedules translations for English and Romanian
- **schedules**: add schedules UI components
- **schedules**: add client service and hooks for schedules management
- **schedules**: add server-side schedules service with CRUD operations and item management
- **songs**: auto-extract title from first line for new songs
- **songs**: add paste handler to convert empty lines to slide breaks

### 🐛 Bug Fixes

- **bible**: set hasNavigatedOnOpen flag when selecting verse or search result
- **bible**: correct navigateTemporary mutation parameter format
- **presentation**: use temporary navigation when temporary content is displayed
- **kiosk**: refetch presentation state on WebSocket reconnection
- **kiosk**: detect WebSocket disconnection on iOS Tauri
- **kiosk**: always restore brightness on WebSocket reconnection
- **kiosk**: convert PluginInvokeError to Error in iOS plugin registration
- **kiosk**: fix type inference for iOS build
- **kiosk**: restructure screen brightness plugin for proper iOS integration
- **kiosk**: show debug tools on all platforms for testing
- **kiosk**: enable wake lock on iOS by adding plugin permissions and auto-enabling on screen routes
- **kiosk**: use native Tauri plugin for iOS wake lock instead of unreliable Web API
- **presentation**: remove explicit width/height constraints from kiosk mode
- **presentation**: add width/height support to batch update endpoint
- **presentation**: enhance toolbar visibility with click detection and iOS safe area support
- **presentation**: use native screen dimensions for bounds calculation
- **build**: correct ios build script flags
- **next-slide**: display nothing instead of dash when no content
- **screen-content**: use TextContent for next slide section rendering
- **database**: validate SQLite files by checking header instead of PRAGMA integrity_check
- **database**: properly extract PRAGMA integrity_check result value
- **presentation**: add automatic WebSocket reconnection on error
- **presentation**: clear displayed slide on server startup alongside queue
- **navigation**: prevent continuous auto-navigation on Songs and Bible pages
- **presentation**: clear queue on server startup to ensure clean state
- **screen-editor**: add missing preview texts state and actions to editor hook
- **song-import**: add Tauri context check before invoking desktop commands
- **presentation**: fix React reconciliation with stable segment keys and synchronous processing
- **build**: fix production build sidecar bundling and websocket connections
- **midi**: load native module lazily and handle unavailability gracefully
- **server**: use proper application support directories for data storage
- **ci**: switch from pnpm to bun for dependency management
- **ci**: correct pnpm cache dependency path
- **livestream**: prevent multiple concurrent starts from keyboard shortcuts
- **keyboard-shortcuts**: allow canceling livestream start and improve start state detection
- **keyboard-shortcuts**: support multiple actions per MIDI shortcut
- **keyboard-shortcuts**: prevent double-triggering start/stop with state checks
- **bible**: allow Enter key to present searched verse in reference search
- **keyboard-shortcuts**: add isLive state checks to livestream toggle handlers
- **keyboard-shortcuts**: simplify recording ref access pattern
- **keyboard-shortcuts**: prevent stale closure in MIDI and global shortcuts callbacks
- **livestream**: add missing log utility function to routes
- **livestream**: restore client_secret to YouTube OAuth token exchange
- **livestream**: remove unnecessary client_secret from PKCE OAuth flow
- **livestream**: replace YouTube broadcast ready polling with countdown delay
- **queue**: position active item at second position in scroll container
- **livestream**: prevent duplicate OBS reconnect scheduling and add error recovery
- **livestream**: defer OBS auto-connect until WebSocket server is ready
- **presentation**: strip HTML and translation abbreviations from slide preview
- **bible-verses**: ensure verse scrolls into view when navigating to new chapter
- **fixtures**: fix database path resolution and regenerate screen defaults
- **presentation**: show hidden elements as ghosted in editor canvas for re-selection
- **presentation**: hide elements in editor canvas when hidden property is set
- **presentation**: simplify element visibility control by renaming visibleWhenHidden to hidden
- **screens**: combine where conditions with and() to prevent overwriting
- **presentation**: improve race condition handling with version counter tracking instead of timeouts
- **screen-editor**: prevent race condition in element property saves
- **presentation**: add screen dependency to ResizeObserver effect
- **screen-editor**: accept constraints instead of position in element update handler
- **presentation**: standardize screen rendering positioning with pre-scaled pixel coordinates
- **presentation**: use screen config dimensions and scale for text elements
- **constraint-controls**: resolve stale closure in drag and resize handlers
- **presentation**: use constraints-based positioning and fix config overwrites
- **queue**: decode HTML entities in slide preview text
- **song-import**: preserve en-dashes and em-dashes in sanitized titles
- **sanitization**: remove leading numbers from song titles
- **song-import**: filter special characters from extracted slide titles
- **server**: add timeout to token verification to prevent hanging
- **server**: detect all server IPs for local admin access
- **client**: use dynamic hostname in fetcher and display windows
- **server**: listen on all network interfaces for LAN access
- **i18n**: correct export progress wording in settings translations
- **song-export**: add write permissions and improve progress modal timing
- **search**: fall back to original terms when all search terms filtered as noise
- **search**: increase fuzzy substring threshold and prioritize FTS results
- **search**: enable fuzzy substring matching for spelling variations
- **songs**: improve search input responsiveness with local state
- **pptx-import**: handle embedded newlines in PPTX text elements
- **songs**: use Tauri readFile for local PPTX file reading
- **pptx-import**: fix drag and drop event capture using document-level listeners
- **presentation**: remove animation delay for instant preview state feedback
- **presentation**: relocate show/hide button and fix restore after hide
- **songs**: escape FTS5 special characters and enable diacritic-insensitive search
- **editor**: disable autocorrect to prevent unwanted dots on space
- **songs**: center SongPickerModal dialog
- **presentation/keyboard-shortcuts**: disable shortcuts in modals and contenteditable elements
- **presentation/broadcast**: refresh displays when currently shown slide is updated
- **presentation**: add cache-busting headers to queue fetch calls
- **control-room**: support standalone slide navigation and fix queue item highlighting
- **songs**: populate search index after migrations and on deletion
- **db**: remove orphaned foreign key column before dropping presentation_queue
- **deps**: downgrade @dnd-kit/sortable to v9.0.0 to resolve breaking changes in v10
- **client**: add missing config file with getApiUrl
- **songs**: add clipboardTextSerializer to control newlines in copy/paste
- **songs**: prevent paste handler from blocking regular paste operations

### 🔧 Changes

- various improvements
- **db**: update embedded migrations object literal syntax
- **kiosk**: fix line endings and formatting in kiosk components
- **common**: add connection error messages for English and Romanian
- various improvements
- various improvements
- **presentation**: implement separate X/Y scaling for screen content
- **presentation**: make screen rendering responsive with fixed scaling approach
- various
- **tauri**: replace default Tauri icons with custom app icons
- create fixtures
- **screen-editor**: move line compression controls to text style section
- various improvements
- various improvements
- various improvements
- various improvements
- up
- various improvements
- improve app startup performance
- various improvements
- various improvements
- various improvements
- optimistic scene change
- various imrpvoements
- various fixes
- various fixes
- Update TODO.md
- various improvements
- various improvements
- generate fixtures
- **highlight-colors**: remove poorly implemented feature from codebase
- Revert "fix(presentation): fix React reconciliation with stable segment keys and synchronous processing"
- various improvements
- various improvements
- **presentation**: hide loading messages on screen display routes
- various improvements
- **songs**: remove duplicate headers from song panel components
- **songs**: use indigo color for edit button instead of purple
- **songs**: reorganize song preview and presentation flow
- various improvements
- Update TODO.md
- various improvements
- **server**: fix imports and line endings in utility files
- **server**: fix migrations and script formatting
- **client**: fix import ordering and line formatting in router
- **project**: ignore application logs directory
- **ci**: add macOS quarantine workaround to release notes
- update bun.lock
- **ci**: simplify build matrix to Windows x64 and macOS ARM64 only
- various improvements
- **settings**: combine API Documentation and System Token into single card
- **settings**: move system token section after API documentation
- remove .playwright-mcp from git tracking
- add secrets folder to gitignore
- various improvements
- **livestream**: add error messages for YouTube authentication issues
- **livestream**: move stream start progress UI from StreamControls to BroadcastInfo
- **livestream**: simplify YouTube setup modal
- **livestream**: replace local templates with YouTube past broadcasts
- **queue**: extract scrolling logic into reusable hook
- livestream page
- various improvements
- add fixtures
- **fixtures**: consolidate dump script to handle multiple fixture types
- **scripts**: add fixtures:screens script for generating screen fixtures
- **seeds**: extract screen configurations to JSON fixtures for easier maintenance
- **presentation**: remove client-side migration utilities for legacy position formats
- **presentation**: synchronize types and default configs to constraints-based positioning
- **presentation**: move background styling to fullscreen container
- **presentation**: unify text rendering with TextContent and AnimatedElement
- **presentation**: unify screen rendering with ScreenContent component
- **presentation**: migrate from displays to screens API
- **constraint-controls**: make constraint values editable directly on diagram
- various improvements
- various improvements
- various fixes
- **ui**: replace native select elements with Combobox component
- various fixes
- various improvements
- various improvements
- various improvements
- various improvements
- **bible**: replace 3-panel layout with 2-panel resizable layout
- migrate to drizzle orm
- add Bible page
- various improvements
- **client**: use dynamic hostname for API URLs
- **auth**: migrate from device-based to user-based authentication with RBAC
- up
- various improvements
- **search**: implement two-phase search ranking with simplified FTS5 queries
- **songs**: improve search relevance with N-1 and N-2 term AND queries
- various improvements
- **openapi**: add comprehensive api documentation for all endpoints
- **search**: optimize song search with subquery and minimum score filtering
- **presentation**: remove dynamic border from preview component
- **presentation**: change displayed state border color to white
- **presentation**: update hidden state border color to white
- **presentation**: add border to show/hide buttons in control center
- **presentation**: implement isHidden flag for show/hide state management
- **presentation**: move preview toggle button to header
- **queue**: replace context menu submenu with dialog for Insert After
- **queue**: convert Add button to dialog with 3 options
- **queue**: use filled buttons for Add and Clear Queue actions
- **routing**: redirect homepage to control room
- **sidebar**: update present menu icon from Film to SquarePlay
- **ui**: simplify navigation and remove program selector
- various improvements
- **settings**: integrate application description with page title
- **settings**: move application settings section to top of page
- **presentation**: move display management to settings page
- add all
- add project documentation and task tracking
- **deps**: update dependencies and generated files
- **settings**: add device management translations
- reformat code with consistent quotes and import organization
- **service**: export device service from service barrel
- various improvements

## v0.1.7 — 2025-12-25

### 🚀 Features

- **database**: add import functionality with validation and backup
- **settings**: add database management with info and export functionality
- **bible**: add auto-navigation and sync with temporary Bible content
- **songs**: add auto-navigation to presented song on page open

### 🐛 Bug Fixes

- **database**: validate SQLite files by checking header instead of PRAGMA integrity_check
- **database**: properly extract PRAGMA integrity_check result value
- **presentation**: add automatic WebSocket reconnection on error
- **presentation**: clear displayed slide on server startup alongside queue
- **navigation**: prevent continuous auto-navigation on Songs and Bible pages
- **presentation**: clear queue on server startup to ensure clean state
- **screen-editor**: add missing preview texts state and actions to editor hook
- **song-import**: add Tauri context check before invoking desktop commands
- **presentation**: fix React reconciliation with stable segment keys and synchronous processing

### 🔧 Changes

- various improvements
- various improvements
- generate fixtures
- **highlight-colors**: remove poorly implemented feature from codebase
- Revert "fix(presentation): fix React reconciliation with stable segment keys and synchronous processing"
- various improvements

## v0.1.6 — 2025-12-23

### 🚀 Features

- **presentation**: add skipTaskbar option to hide display windows from dock
- **songs**: add "Add to Schedule" button to song preview page header
- **songs**: update preview header with back button and song title
- **songs**: move edit button to header row with purple styling
- **presentation**: add temporary content support to LivePreview component
- **presentation**: add temporary content presentation mechanism
- **presentation**: use screen name in window titles instead of display ID
- **songs**: add placeholder to Musical Key input field
- **combobox**: add React Portal support to dropdown rendering

### 🔧 Changes

- various improvements
- **presentation**: hide loading messages on screen display routes
- various improvements
- **songs**: remove duplicate headers from song panel components
- **songs**: use indigo color for edit button instead of purple
- **songs**: reorganize song preview and presentation flow
- various improvements
- Update TODO.md

## v0.1.5 — 2025-12-23

### 🔧 Changes

- various improvements

## v0.1.4 — 2025-12-22

### 🚀 Features

- **presentation**: add fullscreen controls and auto-maximize handling

## v0.1.3 — 2025-12-22

### 🐛 Bug Fixes

- **build**: fix production build sidecar bundling and websocket connections

## v0.1.2 — 2025-12-22

### 🐛 Bug Fixes

- **midi**: load native module lazily and handle unavailability gracefully

### 🔧 Changes

- **server**: fix imports and line endings in utility files
- **server**: fix migrations and script formatting
- **client**: fix import ordering and line formatting in router
- **project**: ignore application logs directory

## v0.1.1 — 2025-12-22

_No notable changes._

## v0.1.0 — 2025-12-22

### 🚀 Features

- **build**: add embedded migrations and server startup health checks

### 🐛 Bug Fixes

- **server**: use proper application support directories for data storage
- **ci**: switch from pnpm to bun for dependency management
- **ci**: correct pnpm cache dependency path

### 🔧 Changes

- **ci**: add macOS quarantine workaround to release notes
- update bun.lock
- **ci**: simplify build matrix to Windows x64 and macOS ARM64 only

## v0.0.1 — 2025-12-22

### 🚀 Features

- **system-token**: add system token management UI with localhost-only API routes
- **settings**: add API documentation link in settings page
- **auth**: add system token API for external app access
- **livestream**: add tooltip component and improve BroadcastInfo UI
- **keyboard-shortcuts**: integrate MIDI device selector into settings UI
- **keyboard-shortcuts**: allow startLive/stopLive to share the same shortcut
- **keyboard-shortcuts**: add recording context and MIDI shortcut support
- **livestream**: return re-auth status in YouTube auth check
- **livestream**: show toast notification when YouTube session expires
- **livestream**: add YouTube OAuth error handling with re-auth detection
- **livestream**: add stream start/stop scene configuration
- **livestream**: add YouTube broadcast readiness check with progress tracking
- **livestream**: refactor scene management with settings modal and drag-and-drop reordering
- **livestream**: enable auto-reconnect for manual OBS connections
- **livestream**: always initialize OBS auto-reconnect at startup
- **livestream**: add OBS WebSocket auto-reconnect with exponential backoff
- **livestream**: wire up OBS callbacks for real-time scene updates
- **presentation**: display next Bible verse as preview
- **api**: add GET /api/bible/next-verse endpoint
- **bible**: add getNextBook and getNextVerse service functions
- **presentation**: add comprehensive next slide preview for all content types
- **bibles**: export and seed books and verses in Bible fixtures
- **db**: add seeding for songs, bibles, categories, and settings on startup
- **db**: add automatic seeding of default screens on app installation
- **presentation**: add visibleWhenHidden property to control element visibility in hidden mode
- **presentation**: add title and content style configuration for next slide element
- **presentation**: integrate batch update API in screen manager for atomic saves
- **presentation**: add batch update API endpoint for atomic screen config saves
- **screen-preview**: add background styling to preview container
- **constraint-controls**: add unit conversion and improve constraint UI
- **presentation**: add value indicators with units to constraint anchor points
- **presentation**: auto-open active screens on startup
- **webview**: upgrade Chrome user agent and improve video playback performance
- **bible**: separate verse selection from presentation
- **bible**: implement interactive 3-panel presentation UI with navigation, queue, and controls
- **db**: implement modular migration engine with version tracking
- **song-import**: standardize song title sanitization across client and server
- **songs**: add source file path display to song editor UI
- **song-import**: extract title from first slide and clean non-alphanumeric characters
- **server**: add token-based user authentication endpoint
- **server**: validate permissions on protected API endpoints
- **client**: protect routes with permission guards
- **i18n**: add permission error messages for access denied pages
- **ui**: create PagePermissionGuard component for route protection
- **song-export**: add complete import/export feature with OpenSong XML support
- **song-import**: add support for PPT files in ZIP archives with server-side conversion
- **song-import**: add PPT to PPTX conversion support with LibreOffice
- **search**: enhance relevance with fuzzy highlighting, rarity boost, and noise filtering
- **search**: add diacritic-insensitive highlighting with word boundary matching
- **search**: enhance fuzzy match highlighting with extended candidate pool
- **ui/categories**: add CategoryManager component with drag-drop sorting
- **api**: add category reorder endpoint and integrate priority into search
- **categories**: add priority field to song categories
- **search**: add trigram fuzzy search for substring matching
- **song-import**: add import options for title extraction and duplicate handling
- **songs**: improve search ranking with field-weighted scoring and tiered query matching
- **songs**: add error modal when no valid songs found during file import
- **songs**: add search persistence and limit song list to 50 rows
- **song-import**: add progress indicator and increase batch size to 200
- **song-import**: add batch import with progress tracking and OpenSong support
- **sidebar**: make sidebar mobile-responsive with hamburger menu and drawer
- **pptx-import**: directly create songs on PPTX import without dialog
- **songs**: add PPTX import button with file dialog integration
- **pptx-import**: add PPTX file import with file association and drag-drop
- **presentation**: add dynamic preview border with display state indicator
- **presentation**: enhance control room with status indicator and immediate preview
- **queue**: add menu options for inserting songs and slides at specific positions
- **queue**: make song titles clickable to select first slide
- **queue**: add editing support for standalone slides
- **queue**: add song editing and slide insertion to control room
- **sidebar**: rename present feature to control room and update icon
- **presentations-programs**: implement comprehensive programs and presentation management system
- **routes/songs**: add dedicated songs management page
- **routes/settings**: add authorized devices section to settings page
- **client/devices**: implement device management UI and hooks
- **server**: integrate device authentication endpoints and middleware
- **openapi**: add OpenAPI specification and Scalar documentation
- **middleware**: add device authentication and permission validation
- **service/devices**: implement device CRUD and token management service
- **db**: add device and device permissions database schema
- **songs**: add editor component, management hooks, and toast/modal UI utilities
- **ui**: add reusable modal and toast components
- **routing**: restructure app routes and add toast provider to layout
- **ui**: update sidebar navigation to include songs and schedules
- **i18n**: add common button labels and presentation namespace
- **presentation**: add presentation mode feature for schedules
- **schedules**: implement schedule editor with drag-and-drop reordering
- **i18n**: add schedules translations for English and Romanian
- **schedules**: add schedules UI components
- **schedules**: add client service and hooks for schedules management
- **schedules**: add server-side schedules service with CRUD operations and item management
- **songs**: auto-extract title from first line for new songs
- **songs**: add paste handler to convert empty lines to slide breaks
- **server**: enable compiled Bun binary for Tauri sidecar deployment
- **database**: implement SQLite with migrations, service layer, and settings API

### 🐛 Bug Fixes

- **livestream**: prevent multiple concurrent starts from keyboard shortcuts
- **keyboard-shortcuts**: allow canceling livestream start and improve start state detection
- **keyboard-shortcuts**: support multiple actions per MIDI shortcut
- **keyboard-shortcuts**: prevent double-triggering start/stop with state checks
- **bible**: allow Enter key to present searched verse in reference search
- **keyboard-shortcuts**: add isLive state checks to livestream toggle handlers
- **keyboard-shortcuts**: simplify recording ref access pattern
- **keyboard-shortcuts**: prevent stale closure in MIDI and global shortcuts callbacks
- **livestream**: add missing log utility function to routes
- **livestream**: restore client_secret to YouTube OAuth token exchange
- **livestream**: remove unnecessary client_secret from PKCE OAuth flow
- **livestream**: replace YouTube broadcast ready polling with countdown delay
- **queue**: position active item at second position in scroll container
- **livestream**: prevent duplicate OBS reconnect scheduling and add error recovery
- **livestream**: defer OBS auto-connect until WebSocket server is ready
- **presentation**: strip HTML and translation abbreviations from slide preview
- **bible-verses**: ensure verse scrolls into view when navigating to new chapter
- **fixtures**: fix database path resolution and regenerate screen defaults
- **presentation**: show hidden elements as ghosted in editor canvas for re-selection
- **presentation**: hide elements in editor canvas when hidden property is set
- **presentation**: simplify element visibility control by renaming visibleWhenHidden to hidden
- **screens**: combine where conditions with and() to prevent overwriting
- **presentation**: improve race condition handling with version counter tracking instead of timeouts
- **screen-editor**: prevent race condition in element property saves
- **presentation**: add screen dependency to ResizeObserver effect
- **screen-editor**: accept constraints instead of position in element update handler
- **presentation**: standardize screen rendering positioning with pre-scaled pixel coordinates
- **presentation**: use screen config dimensions and scale for text elements
- **constraint-controls**: resolve stale closure in drag and resize handlers
- **presentation**: use constraints-based positioning and fix config overwrites
- **queue**: decode HTML entities in slide preview text
- **song-import**: preserve en-dashes and em-dashes in sanitized titles
- **sanitization**: remove leading numbers from song titles
- **song-import**: filter special characters from extracted slide titles
- **server**: add timeout to token verification to prevent hanging
- **server**: detect all server IPs for local admin access
- **client**: use dynamic hostname in fetcher and display windows
- **server**: listen on all network interfaces for LAN access
- **i18n**: correct export progress wording in settings translations
- **song-export**: add write permissions and improve progress modal timing
- **search**: fall back to original terms when all search terms filtered as noise
- **search**: increase fuzzy substring threshold and prioritize FTS results
- **search**: enable fuzzy substring matching for spelling variations
- **songs**: improve search input responsiveness with local state
- **pptx-import**: handle embedded newlines in PPTX text elements
- **songs**: use Tauri readFile for local PPTX file reading
- **pptx-import**: fix drag and drop event capture using document-level listeners
- **presentation**: remove animation delay for instant preview state feedback
- **presentation**: relocate show/hide button and fix restore after hide
- **songs**: escape FTS5 special characters and enable diacritic-insensitive search
- **editor**: disable autocorrect to prevent unwanted dots on space
- **songs**: center SongPickerModal dialog
- **presentation/keyboard-shortcuts**: disable shortcuts in modals and contenteditable elements
- **presentation/broadcast**: refresh displays when currently shown slide is updated
- **presentation**: add cache-busting headers to queue fetch calls
- **control-room**: support standalone slide navigation and fix queue item highlighting
- **songs**: populate search index after migrations and on deletion
- **db**: remove orphaned foreign key column before dropping presentation_queue
- **deps**: downgrade @dnd-kit/sortable to v9.0.0 to resolve breaking changes in v10
- **client**: add missing config file with getApiUrl
- **songs**: add clipboardTextSerializer to control newlines in copy/paste
- **songs**: prevent paste handler from blocking regular paste operations
- **window**: persist position, size, and state across application restarts
- **build**: suppress Rust compiler warnings with conditional imports
- **build**: configure dev server port and auto-start command to fix 404 error

### 🔧 Changes

- various improvements
- **settings**: combine API Documentation and System Token into single card
- **settings**: move system token section after API documentation
- remove .playwright-mcp from git tracking
- add secrets folder to gitignore
- various improvements
- **livestream**: add error messages for YouTube authentication issues
- **livestream**: move stream start progress UI from StreamControls to BroadcastInfo
- **livestream**: simplify YouTube setup modal
- **livestream**: replace local templates with YouTube past broadcasts
- **queue**: extract scrolling logic into reusable hook
- livestream page
- various improvements
- add fixtures
- **fixtures**: consolidate dump script to handle multiple fixture types
- **scripts**: add fixtures:screens script for generating screen fixtures
- **seeds**: extract screen configurations to JSON fixtures for easier maintenance
- **presentation**: remove client-side migration utilities for legacy position formats
- **presentation**: synchronize types and default configs to constraints-based positioning
- **presentation**: move background styling to fullscreen container
- **presentation**: unify text rendering with TextContent and AnimatedElement
- **presentation**: unify screen rendering with ScreenContent component
- **presentation**: migrate from displays to screens API
- **constraint-controls**: make constraint values editable directly on diagram
- various improvements
- various improvements
- various fixes
- **ui**: replace native select elements with Combobox component
- various fixes
- various improvements
- various improvements
- various improvements
- various improvements
- **bible**: replace 3-panel layout with 2-panel resizable layout
- migrate to drizzle orm
- add Bible page
- various improvements
- **client**: use dynamic hostname for API URLs
- **auth**: migrate from device-based to user-based authentication with RBAC
- up
- various improvements
- **search**: implement two-phase search ranking with simplified FTS5 queries
- **songs**: improve search relevance with N-1 and N-2 term AND queries
- various improvements
- **openapi**: add comprehensive api documentation for all endpoints
- **search**: optimize song search with subquery and minimum score filtering
- **presentation**: remove dynamic border from preview component
- **presentation**: change displayed state border color to white
- **presentation**: update hidden state border color to white
- **presentation**: add border to show/hide buttons in control center
- **presentation**: implement isHidden flag for show/hide state management
- **presentation**: move preview toggle button to header
- **queue**: replace context menu submenu with dialog for Insert After
- **queue**: convert Add button to dialog with 3 options
- **queue**: use filled buttons for Add and Clear Queue actions
- **routing**: redirect homepage to control room
- **sidebar**: update present menu icon from Film to SquarePlay
- **ui**: simplify navigation and remove program selector
- various improvements
- **settings**: integrate application description with page title
- **settings**: move application settings section to top of page
- **presentation**: move display management to settings page
- add all
- add project documentation and task tracking
- **deps**: update dependencies and generated files
- **settings**: add device management translations
- reformat code with consistent quotes and import organization
- **service**: export device service from service barrel
- various improvements
- bootstrap the project
- **config**: update dev server port from 3001 to 8086
- **project**: initialize church-hub application with Tauri sidecar
