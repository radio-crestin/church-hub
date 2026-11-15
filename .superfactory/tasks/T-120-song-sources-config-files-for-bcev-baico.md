---
id: T-120
title: "Song sources: config files for BCEV Băicoi, Laudele Domnului, Pe drumul credinței; user sources synced to their own S3 and shareable"
kind: task
level: normal
order: -11
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T20:12:19.746Z
---

## Goal
User's words (2026-10-06): "then for the songs, create in the repo a file with config pointing to bcev baicoi songs, another one for laudele Domnului, Pe drumul credintei and resurse crestine is a built in category..) allow the user to add more data sources after they configure theyr own s3 endpoint and the app will keep things in sync there.. and it can be shared with others and they can import and use the songs..".

1. In the repo, one config file per song source: BCEV Băicoi, Laudele Domnului, Pe drumul credinței, each pointing to where its songs come from. Resurse Creștine stays a built-in category/source.
2. Users can add more song sources once they configure their own S3 endpoint; the app keeps those songs in sync there.
3. A source can be shared with others, who import it and use its songs.
Related: T-072 (serverless sync and shared song library on S3, backlog) and the cloud-sync architecture memory; T-113 (dev-fixtures) is changing which songs ship in the fixtures, so coordinate with it on song fixture files. Credentials for S3 must never land in fixtures, the repo or builds.

## Notes

- 2026-10-06: Started on branch task/T-120 (from main af2b66a7). Exploring the current song import/sources code and T-072 before planning.
- 2026-10-06: Findings. Today: the client has one SourceProvider (resurseCrestine.ts, OpenSong ZIP via /api/proxy/download, proxy allowlist hardcoded twice in server index.ts), with discovery/staging at /songs/discover. DB on main is SQLite; songs carry no source id. No S3 code anywhere; Bun 1.3+ has a built-in S3Client (no new native dep). Shipped default-songs.json (52 MB) already holds BCEV Baicoi 2198, Pe Drumul Credinței 454, Laudele Domnului 198, Resurse Crestine 23541 songs. Web: LD and PDC are on cantaricrestine.ro's public JSON API (api.php?categorie=ld|pdc; terms allow free distribution, no selling); LD 800 entries (491 numbered), PDC 845 (456 numbered 001-456). BCEV Băicoi has no live public source (old .tk sites and Firebase are dead); its only copy is our fixture. Asking the lead the product questions (BCEV host, share format, fixture fate).
- 2026-10-06: Phase A done (483c069f): built-in source configs in app/apps/server/src/service/song-sources/built-in/ (resurse-crestine, laudele-domnului, pe-drumul-credintei), GET /api/song-sources (+OpenAPI), proxy allowlist derived from source hosts, discovery screen picker per source (?source=id), cantaricrestine API parser. Checked in a browser on 3220: PDC shows 810 online / 167 new. Waiting on lead for: BCEV host, share format, fixture fate. BEFORE screenshot: scratchpad t120/before-discover.png. Test server: port 3220, DB in scratchpad t120/db.sqlite.
- 2026-10-06: User's answers (2026-10-06) to the teammate's 4 questions:
1. BCEV Băicoi host: "github release asset, a compressed opensong kind of archive with our own extension which is also opened by us, also make sure that hte user can export it.. or sync it to an s3, by configuring access, secret key, host path and so on.. and then you get a public url so it can be shared with others, in the s3 you just update each song and also have a fast way to detect latest changes in both type formats (s3 or file)".
   => A song bundle = compressed OpenSong-like archive with our own file extension, which the app opens. Users can export a bundle as a file, or sync it to S3 (access key, secret, host, path…) and get a public URL to share. In S3, songs are updated individually (per-song objects), with a fast way to detect the latest changes in both forms (S3 and file), e.g. a manifest with per-song hashes/timestamps.
2. Laudele Domnului / Pe drumul credinței configs point at cantaricrestine.ro's API: yes (lead's call, the proposed default).
3. Shipping: "keep a bundled copy so that it can also work when installed offline" => the three stay pre-installed in the installer as a bundled copy; the sources keep them updated.
4. Sharing: public read-only link.
- 2026-10-06: Video: [T-120.mp4](../tasks_videos/T-120.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/159
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-120/church-hub-T-120.app
What changed:
- Source configs: one JSON per built-in source in app/apps/server/src/service/song-sources/built-in/ (Resurse Creștine OpenSong ZIP; BCEV Băicoi .chsongs; Laudele Domnului and Pe drumul credinței on the cantaricrestine.ro API), served by GET /api/song-sources.
- Song discovery: a source picker (?source=id).
- .chsongs: ZIP of manifest.json + songs/<id>.json with a per-song hash. Export it from Settings > Songs > Song sources; opening or dropping one shows its songs in Song discovery. File association on macOS/Windows/Linux, with one Rust predicate.
- S3 storage: its own table, so the secret is never returned or dumped. Sharing a category uploads per-song objects plus the manifest. A 5-minute sync uploads only changed hashes (no requests when nothing changed); stopping sharing deletes the files.
- Sources from links: reading a folder downloads only changed songs (local cache). Links are fetched with a pinned DNS lookup, private addresses refused on every redirect hop. The proxy allowlist is now the built-in hosts only.
- BCEV: published as bcev-baicoi.chsongs (2198 songs, from the fixture) on the `song-sources` release, a pre-release and not latest, so the app updater ignores it.
- Bundled songs stay in the fixtures (not touched; no conflict with dev-fixtures).
Commits: 483c069f, 18120597, 8a83221b, 2fcc8b17, 3e20a4fc, 8f8e6928.
Checks:
- e2e song-sources.spec 6 passed; song-source-links-private-network 11 passed; the discovery, import, file-drop and formatting-tags specs 36 passed.
- smoke:sidecar passed; cargo check ok.
- By hand on port 3220: the S3 flow against a stand-in S3; BCEV read from the real GitHub asset (0.5 s); LD and PDC from cantaricrestine.
- Romanian strings proposed by Codex, two adjusted.
Security write-ups are in the worktree's gitignored .claude/tasks-private/T-120-security-notes.md.
Not checked:
- A real AWS/R2 bucket: Bun's S3Client was tested only against the stand-in, which skips signature checks.
- The review desktop app by hand.
- Installers' file association on Windows/Linux.
Follow-ups for the lead:
- The background "new songs" badge still watches only Resurse Creștine.
- A source added from a link with the same name as a built-in one shows twice in the picker.
- `bun run lint` has 2 errors already on main (libreoffice-convert dependency, unused textOnly in gemini.ts), not mine.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/159
T-120 Song sources: config files, your own S3, shareable
Song discovery now offers Resurse Creștine, BCEV Băicoi, Laudele Domnului and Pe drumul credinței, each from its own config file. In Settings > Songs you can export a category as a .chsongs file, or connect your S3 bucket and share a category by link. Another church pastes the link and imports the songs it lacks. Only changed songs are uploaded.
- 2026-10-06: Update (lead's ask): the duplicate-names bug is fixed in 2729c1ec. When two sources share a name, e.g. a link named like a built-in one, the Song discovery pill also shows where it comes from: the link's host, or "file"/"fișier" for an opened .chsongs file. BEFORE: scratchpad t120/ui-4-discover-link.png (two identical "Laudele Domnului" pills).
- e2e: song-sources.spec has a new case; 7 passed.
- The video has a new step and replaces the old one. The PR description is updated and the review app rebuilt (same app: link).
- The badge-for-other-sources follow-up is left to the lead; the song-sources pre-release is untouched.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/159
T-120 Song sources: config files, your own S3, shareable
Song discovery now offers Resurse Creștine, BCEV Băicoi, Laudele Domnului and Pe drumul credinței, each from its own config file. In Settings > Songs you can export a category as a .chsongs file, or connect your S3 bucket and share a category by link. Another church pastes the link and imports the songs it lacks. Only changed songs are uploaded. A shared source named like another one is told apart by where it comes from.
- 2026-10-06: User (2026-10-06), asked if T-120 is OK, requested changes: "in song sources release page, make sure to create one archive for each song category which is configured.. also, make sure to use the song filename, and opensong and extend it with our own things if needed.. also allow downloading directly as a zip the same file with opensong inside.. or export all of them as a zip of pptx files.. re-use existing import/export, make sure that it's fast in batch..".
Reading: (1) the `song-sources` release gets one archive per configured song category (not only BCEV Băicoi); (2) inside archives, each song is an OpenSong file named after the song, extended with our own fields only where needed; (3) a category can also be downloaded directly as a plain .zip of the same OpenSong files, or exported as a .zip of .pptx files; (4) reuse the existing import/export code, and make it fast in batch.
Also: "new songs" badge must watch every source (built-in and shared links): "yes, do it in the same task".
Security notes copied to the main checkout's .claude/tasks-private/T-120-security-notes.md (user approved).
- 2026-10-06: User (2026-10-06), on which categories get release archives: "all of them, also move the refresh of resurse crestine code to be done in a github action and published automatically.. make sure that the app is fetching it from here from now on..".
=> Archives (.chsongs + plain OpenSong .zip) for all four configured categories on the song-sources release. The Resurse Creștine refresh (the code that pulls from resursecrestine.ro) moves into a GitHub Action that rebuilds and publishes the RC archive to the release automatically (scheduled); the app's RC source now fetches from the release, not resursecrestine.ro. LD/PDC: keep cantaricrestine.ro as the source (lead's call, the teammate's default; user didn't ask to change them).
- 2026-10-06: User (2026-10-06): "impove also the download latest songs ui to be better, nicer, easier to select and refresh them.. integrate into the update notification.. also integrate some checksum to know when a source was udpated so you can sync it..".
=> (1) Redesign the Song discovery / download-latest-songs UI: nicer, easier to select sources/songs and to refresh them. (2) "New songs available" goes into the app's existing update notification (alongside app updates), for every source. (3) Each source publishes a checksum (e.g. in a small manifest next to the archive / per-song hashes on S3) so the app can cheaply tell a source changed and sync it.
- 2026-10-06: Handoff (song-sources, context is getting tight). The PR is pushed with everything below; the video, review app and "For the user" block are NOT yet updated for these changes.
Done since the last report:
- fe8d0811: new workspace package app/packages/song-formats (OpenSong writer writeOpenSongXml, slidesToOpenSongVerses, htmlToPlainText, removeHtmlTags, decodeHtmlEntities, sanitizeFilename; later sanitizeSongTitle, isOpenSongXml, mightBeOpenSongFile).
  - The client's generateOpenSongXml uses it; its client utils re-export it.
  - The importers share one OpenSong check, so .opensong files and the XML declaration import.
  - Parser: reads <source_filename>; option exactTitle for our own files.
- a3888d3a + 3f4cc52a:
  - Bundles (format v2) hold manifest.json + "<song file name>.opensong" per song.
  - Settings > Song file: .chsongs / OpenSong .zip / PowerPoint .zip; the PowerPoint one reuses useExportSongs.
  - The badge checks every source (hooks/checkSourceForNewSongs.ts, per-source state in localStorage "song-discovery-source:<id>"; the combined state goes in "song-discovery-signature").
- fd9a011e:
  - Resurse Creștine source is a song-bundle-file from the release.
  - Workflow .github/workflows/resurse-crestine-archive.yml runs daily plus on dispatch. It calls app/apps/server/scripts/build-resurse-crestine-archive.ts (3 s, 24451 songs) and uploads only when the checksum changed.
  - Checksums: manifest.checksum plus "<archive>.chsongs.sha256" on the release; GET /api/song-sources/:id/checksum (cantaricrestine = song count).
  - Song files download via GET /api/song-sources/:id/archive and unzip client-side (readSongBundleFile, also plain OpenSong zips).
  - Removed: the opensong-zip format and fetcher, /api/proxy/head, fetchCatalogSignature.
  - ImportExportManager's one-shot RC import uses the source URL.
- Release song-sources (pre-release): .chsongs, .zip and .chsongs.sha256 for all four categories. RC is fresh from upstream; BCEV/LD/PDC come from a fresh fixture DB.
- Checks:
  - e2e: song-sources, song-source-links, song-discovery*, file-drop-import, song-import-export, song-formatting-tags: 37 passed.
  - smoke:sidecar passed.
  - All three discovery specs now mock **/api/song-sources/resurse-crestine/archive.
Still to do (user's newest request):
1. "Integrate into the update notification": show new songs available (per source, from the background check's per-source counts) inside the app's existing update notification (features/app-update), with a link to /songs/discover?source=<id>. The data lives in SongDiscoveryContext (useSongDiscovery: badgeCount, newCount; per-source counts via readSourceCheck(id)).
2. "Nicer, easier Song discovery UI": selecting and refreshing sources (SourcePicker.tsx + SourceDiscovery.tsx). E.g. a pill per source showing its new-song count and last check, a refresh per source or all, and a clearer empty/loading state.
3. Then: new video (spec at scratchpad T-120/spec.json; screens via walk.ts and twin.ts on port 3220 with my scratch DB t120/db.sqlite and env CHURCH_HUB_ALLOW_LOOPBACK_LINKS=true); rerun task_pr.py open; `bun app/scripts/review-build.ts T-120`; new "For the user" block.
Notes: the e2e test server sets CHURCH_HUB_ALLOW_LOOPBACK_LINKS=true (playwright.config). Release archives for BCEV/LD/PDC were exported with export-archives.sh (scratchpad T-120) from a fresh fixture DB.
- 2026-10-06: 2026-10-06: Taken over from song-sources (new teammate, worktree agent-aee94943126c7981f, branch pushed to task/T-120).
- abd4e675: new songs from every source in the sidebar update notification (NewSongsNotice next to AppUpdateNotice; per-source lines open /songs/discover?source=id; dismiss lasts until a source's checksum changes). Song discovery: each source tab shows its new-song count or a check mark, "Checked <when>" + "Check all sources"; checkboxes pick songs, Select all / Clear selection, one count line. The screen records its own count for the tab and the notice after an import. e2e song-updates-notice.spec (2), discovery and sources specs: 12 passed.
- fd396554: bug found while checking: the Resurse Creștine archive had 216 songs that were invalid XML (bare "&" in authors, vertical tabs), and one bad song failed the whole RC catalogue. Fixed in the archive builder (toValidXml) and in the reader (a broken song is skipped and logged). Rebuilt archive validated with DOMParser (24451 songs, 0 bad), uploaded to the song-sources release. BCEV/LD/PDC archives: 0 bad.
- Lead's lint asks (song-discovery.spec import order, LyricsDiffView suppression) fixed in fd396554.
BEFORE: scratchpad T-120/v2/before-discover.png, before-discover-mobile.png. AFTER: T-120/v2/after-*.png.
- 2026-10-06: 2026-10-06: Done (song-sources-2). The user's last requests are in: new songs in the update notification, a nicer Song discovery, and a checksum per source (already done by song-sources).
Video: [T-120.mp4](../tasks_videos/T-120.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/159
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-120/church-hub-T-120.app
What changed (since the handoff):
- Update notification: under the app-update card in the sidebar, a "N new songs to download" card lists each source with its count. Each line opens Song discovery on that source. Dismissing it lasts until a source's checksum changes (abd4e675).
- Song discovery:
  - Each source tab shows its new songs, or a check mark when you have them all.
  - "Checked … ago" and "Check all sources" sit under the tabs.
  - Checkboxes pick songs, with Select all / Clear selection and one count line.
  - After an import, the screen's own count updates the tab and the notification (abd4e675).
- Resurse Creștine fix: 216 songs in the release archive were invalid XML, and one bad song failed the whole catalogue.
  - The builder repairs them and the reader skips a broken song (fd396554).
  - The archive was rebuilt and uploaded to the song-sources release: all 24451 songs parse.
- e2e: the formatting-tags spec uses the new checkbox (732b1588).
Commits: abd4e675, fd396554, 732b1588.
Checks:
- e2e: song-sources, song-source-links, song-discovery*, file-drop-import, song-import-export, song-formatting-tags, song-updates-notice (new), app-update: 44 passed.
- Biome is clean on the changed files. The lead's two lint items are fixed.
- By hand on port 3220, with the real background check: the notice listed RC 204, LD 488 and PDC 474. Song discovery's count matched after comparing (PDC 474).
- Romanian strings: proposed by Codex. I adjusted the toolbar line and the plural forms.
Not checked:
- The review desktop app by hand.
- A real AWS/R2 bucket (as before).
Notes:
- The one-time "new songs" toast still shows next to the notice. I kept it, but it can go if the user finds it redundant.
- Comparing a source with a large library is slow, about 10 s per 150 songs (PDC took about 50 s). That is pre-existing, not from this task.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/159
T-120 Song sources: config files, your own S3, shareable
Each songbook is a config file, with its archive on the song-sources release. Resurse Creștine is rebuilt there every day. New songs from every source now show in the sidebar's update notification, and each source opens in Song discovery. There, each tab shows how many songs are new, a checkbox picks a song, and one button checks all sources again. In Settings > Songs you can save a category as a .chsongs file, an OpenSong .zip or a PowerPoint .zip, or share it from your own S3 bucket by link.
- 2026-10-06: 2026-10-06: Done (song-sources-2): the user's last asks are in. The video, the PR description and the review app have been redone for the whole task.
Video: [T-120.mp4](../tasks_videos/T-120.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/159
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-120/church-hub-T-120.app
What changed since the handoff:
- Update notification: a "N new songs to download" card sits under the app-update card and lists each source with its count. Each line opens Song discovery on that source. Dismissing the card lasts until a source's checksum changes. It shows in the browser too, not only in Tauri.
- Song discovery:
  - Each source tab shows its new-song count, or a check mark when the library has every song.
  - Under the tabs: "Checked … ago" and a "Check all sources" button.
  - A checkbox per song picks it, and clicking the name opens the song for review. The Import/Skip buttons are gone.
  - Select all toggles to Clear selection, with one count line instead of the old stats chips.
  - After an import, the screen's own count updates the tab and the notification.
  - On phones, the refresh button shows only its icon.
- Resurse Creștine fix: 216 songs in the release archive were invalid XML, and one bad song failed the whole catalogue. The builder now repairs them, and the reader skips a broken song and logs it. The rebuilt archive (24451 songs, 0 invalid) is uploaded to the song-sources release. BCEV/LD/PDC were checked too: 0 invalid.
- The lead's lint items are fixed.
Commits: abd4e675, fd396554, 732b1588.
Checks:
- e2e: song-sources, song-source-links, song-discovery*, file-drop-import, song-import-export, song-formatting-tags, song-updates-notice (new) and app-update: 44 passed.
- Biome is clean on the changed files.
- Romanian strings proposed by Codex. Two adjusted: the tab badge is "N noi", and the summary matches the existing wording.
- By hand on port 3220: the real background check over all four sources, then the notice, the tabs, picking songs and Check all.
Not checked:
- The review desktop app by hand.
- smoke:sidecar not rerun: client-only changes plus a CI script.
For the lead:
- The one-time "N new songs" toast still fires next to the new notice. I kept it; say if it should go.
- Comparing a source with a big library is slow (about 10 s per 150 songs). That is not from this task.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/159
T-120 Song sources: config files, your own S3, shareable
Every songbook (Resurse Creștine, BCEV Băicoi, Laudele Domnului, Pe drumul credinței) has its own config file. Each has an archive on GitHub, as a Church Hub file and as an OpenSong zip, and Resurse Creștine is refreshed there every day.
New songs from every source now appear in the update notification in the sidebar. Click one to open it in Song discovery, where each source shows how many songs are new and checkboxes make picking easy.
In Settings > Songs you can export a category (Church Hub file, OpenSong zip or PowerPoint zip), or share it from your own S3 by link.
- 2026-10-06: User (2026-10-06), asked if T-120 is OK, requested changes (verbatim): "here i want a single notification , implement a nice notification place where you display once in a popup, then collapse them under a bell icon with an indicator.. also for all these things, send me a single notification.. implement also an option to update it automatically on startup (make sure that is happening a bit delayed and also on a separate core to not make the app slower, make it efficient, test it.. so that the usage of the app is not affected.. by default this config should be on), also in the descarca ultimele cantari page, make it be similar like the other pages, firstly add checkboxes for all the things and by default all of them will be checked, then also all the songs and a big button on the same line to import all of them..  also add on the left side a search option.. integrate the entir epage nicely and make it intuitive, also allow to paste a link to a chsongs file.. also make sure that these files are assigned to churchub and when clicked they will open the imprt view.."
Screenshot: the sidebar card "1166 de cântări noi de descărcat" with rows Resurse Creștine 204, Laudele Domnului 488, Pe drumul credinței 474, and a close X, highlighted in red.
Also: remove the old one-time "N new songs" pop-up (user chose "Remove it").
Reading:
1. Notification center: one notification for all new songs (not a card per thing). New notifications show once as a pop-up, then collapse under a bell icon with an unread indicator; app updates and new songs go there too.
2. New setting "Update songs automatically on startup", ON by default: runs a bit after startup, off the UI thread (worker / separate process or core), efficient, measured so app use isn't affected; covered by a test.
3. "Descarcă ultimele cântări" page redesign, consistent with the other pages: checkboxes for all sources, all checked by default; all songs checked by default; a big "Import all" button on the same line; a search on the left; paste a link to a .chsongs file there; intuitive layout.
4. .chsongs files associated with Church Hub on every OS; opening one opens the import view.
- 2026-10-06: 2026-10-06: song-sources-2 started on the user's latest changes. The BEFORE screens are the current build's: scratchpad T-120/v2/n1-notice.png (the sidebar card) and n3-picked.png (Song discovery). Exploring the matching cost, server-side parsing and import, workers in the compiled sidecar, settings, and the file association before I plan.
- 2026-10-06: 2026-10-06: Progress (song-sources-2) on the user's latest changes. Pushed: no; committed locally.
- 3059bec5: one DOM-free OpenSong reader in @church-hub/song-formats, shared by client and server, with the bundle and cantaricrestine readers.
  - Same output as the old DOMParser reader on all 24451 RC + 2198 BCEV songs (it also reads the 216 the old one rejected); 0.4 s for 24k songs.
- e1721f3f, 1a…, db81f112: server song updates run in a Bun Worker (songUpdatesWorker.ts, its own entrypoint in scripts/compile.ts).
  - Runs 30 s after start, then daily; "add new songs automatically" is on by default (app_settings song_sources_auto_update).
  - Adds only songs with no similar version; the songs each source lacks go to data/song-sources/lacking/<id>.json.
  - Routes, all in OpenAPI: GET /api/song-sources/updates, POST /updates/run, PUT /updates/settings, GET /:id/lacking, PUT /:id/new-count.
  - The e2e server sets CHURCH_HUB_SONG_UPDATES_AT_START=false.
- Measured on 3220 against a 26k-song library:
  - A full forced run takes 160-183 s in the worker.
  - Meanwhile a song search answers in a median 1.3 ms, p95 2.9 ms, max 49 ms (quiet baseline: median 1.2-1.5 ms).
  - An unchanged-checksum run takes 1 s.
  - A forced run with auto-update added 177 songs (RC 155, LD 15, PDC 7).
- e2f70215: client.
  - Notification center: a bell in the sidebar with an unread count. Each new notification pops up once (12 s), then lives under the bell. There is one notification for all sources, and the app update has its own.
  - Old toast and sidebar cards removed.
  - Song discovery is one page:
    - Header with "Check all sources" and a big "Import all (N)" button.
    - Left: search, sources with checkboxes and counts, a field to paste a .chsongs link, and the song list with checkboxes. Everything is ticked by default.
    - Right: the review editor.
  - ?source= ticks only that source (an opened .chsongs file, or a line clicked in the notification).
  - The client background check (UI-thread parsing) is gone.
- Left to do:
  - Update the e2e specs (song-discovery, song-sources, song-formatting-tags, song-updates-notice → notification center, lyrics-text).
  - Mobile check, smoke:sidecar (worker entrypoint), the .chsongs open check, video, PR, review build.
Note for the user: after auto-update the remaining songs are all "similar" (versions under other titles), and they are ticked by default as asked.
- 2026-10-06: 2026-10-06: Done (song-sources-2): the user's latest changes are in. The PR, video and review app are updated.
Video: [T-120.mp4](../tasks_videos/T-120.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/159
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-120/church-hub-T-120.app
What changed (on top of the progress note above):
- f5ddd9c8: the song-updates worker is a second entrypoint of the compiled sidecar. The list is shared by compile.ts and the smoke check, in scripts/workerEntrypoints.ts.
  - The worker is found by its path from src/ when compiled, and by URL from source.
  - The smoke check now runs the worker; it caught the wrong compiled path before the fix.
- 450a3f3b, cdda7f06: e2e moved to song sources the server checks (helpers/song-folder-source.ts); new notification-center.spec and song-updates.spec. The lacking-songs cache sits next to the database.
- A link added anywhere (Settings or the page) is checked at once.
- 71f2f72e: removed the unused /api/songs/discovery/count (route, service, OpenAPI, client).
- def23c81: a wider bell panel.
Checks:
- e2e: 46 passed. Specs: notification-center, song-updates, song-sources, song-source-links, song-discovery*, file-drop-import, song-import-export, song-formatting-tags, app-update.
- smoke:sidecar: all 10 checks pass, including the new worker check.
- Lint is clean on my files; the 4 findings left are in other files, already on main.
- Romanian proposed by Codex, adjusted in places ("Importă toate cele N cântări", "N noi").
- By hand on port 3220: the startup run on a fresh copy of the scratch DB added 177 songs (RC 155, LD 15, PDC 7) and left 989 to review. Then the pop-up, bell, page, search, untick, review, settings, and the phone layout.
Not checked:
- The review desktop app by hand.
- The compiled worker on Windows/Linux (smoke runs on those in test.yml before a release).
For the lead / the user:
- After the automatic update, everything left is "Există ceva similar" (a version under another title). As asked, it is all ticked by default, so "Import all" would add 989 near-duplicates. Say if similar songs should start unticked.
- A full check of all four sources takes about 3 minutes in the worker (Laudele Domnului about 75 s, from the library similarity search). App use is not affected: during it, a song search answered in a median 1.3 ms, p95 2.9 ms.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/159
T-120 Song sources: config files, your own S3, shareable
A little after the app starts, it checks every song source in the background and adds the new songs on its own; you can turn this off in Settings > Songs. One notification pops up once with what was added and what's left to review, then waits under a new bell in the sidebar.
"Download the latest songs" is now one page: every source and song is ticked, with a search on the left, a field to paste a .chsongs link, and one "Import all" button. Opening a .chsongs file shows just its songs there.
- 2026-10-06: User (2026-10-06), requested changes (verbatim): "replace this also if there are songs, display also there a small button to download it.. also while it's doing the search dn't display it, display it in the notifications.. but don't make it visible.. allow also the user to cancel it or to open the songs sync configuration..  and by default, don't even ask for approval, sync the changes directly (as you will not replace any modified song.. make this also configurable so that the user can disable it.. as they might want to manually approve the sync.., if there is no internet connection, then don't start the sync and don't display a warning..)".
Screenshot: the "Descarcă cântări" button (sparkle icon, top right, above "Marcaje").
On "similar songs ticked by default?": user answered "i don't know what you mean by ticked". Lead's call: songs that already exist in the library under another title ("Există ceva similar") start unchecked and are not added by the automatic sync; only truly new songs and changes to songs the user hasn't modified sync automatically.
Reading:
1. The "Descarcă cântări" button: when new songs are available, show it with a small count/download affordance there.
2. While a sync/check runs, no pop-up: it shows only quietly inside the notification center (under the bell, not popped up), with actions to cancel it and to open the song sync settings.
3. Default: sync changes directly with no approval (new songs + updates to songs the user never modified; modified songs are never replaced). A setting turns this off for manual approval.
4. No internet: don't start the sync and show no warning.
- 2026-10-06: User (2026-10-06): "also, all notifications will open a new page with all the notifications as a list, nicely designed to follow the app design..". => An "All notifications" page (from the bell, e.g. "See all") listing every notification, designed like the app's other pages; clicking a notification opens it there / its target. EN + RO.
- 2026-10-06: User (2026-10-06): "and for updating the songs, just display the new songs which will be updated, when clicking on the notification allow him to do it manually (if they disabled the auto sync or display the finished result..) keep the notification history for 60 days and then clean up them..".
=> The song-update notification lists only the songs that will be (or were) added/updated. Clicking it: with auto-sync off, opens a manual step to apply them; with auto-sync on, shows the finished result (what was added/updated). Notification history is kept 60 days, then cleaned up automatically.
- 2026-10-06: User (2026-10-06): "also, when there is a new app update, display a notification indicator and then the user can start the update from the notification.. also maek sure that the notification on the sidebar is matchign the settings title and icon.. make them look nice and add it below the feedback..  but to match the look and feel there..".
=> (1) A new app update shows an unread indicator on the notifications entry, and the update can be started straight from its notification. (2) The notifications entry in the sidebar is a regular sidebar item styled exactly like the Settings/Feedback items (icon + title, same look and feel), placed below Feedback.
- 2026-10-06: 2026-10-06: Handoff (song-sources-2, context ~70%). Branch task/T-120 is pushed at e4f152ca. I worked in worktree agent-aee94943126c7981f, whose own branch tracks origin/task/T-120; push with `git push origin HEAD:task/T-120`. The PR description, video and review app still describe the previous round.
Done this round:
- e4f152ca, automatic sync updates:
  - Library songs nobody edited by hand are brought up to date with their source. findChangedSongs.ts finds them (exact match, same title, lyrics differ as plain text, last_manual_edit null); updateLibrarySongs.ts replaces the slides only via upsertSong (no isManualEdit).
  - SourceUpdate gets an `updated` count.
  - Similar songs start unticked on the page (useDiscoverySelection) and were never added automatically.
  - e2e song-updates.spec: a new case for updates and for keeping a song edited by hand; 3 passed.
Left to do (the user's asks this round; full words and the lead's reading are in the notes above):
1. "Descarcă cântări" button (song-discovery/components/DiscoverButton.tsx): show a small count of new songs when there are any. The count is the sum of `newCount` from useSongUpdates().state.sources.
2. No pop-ups for the song sync. NotificationCenter (features/notifications) pops up each new id once; songs must stay under the bell only. App updates must raise the unread count and be startable from their notification (the update page's install action; see app-update hooks useUpdateDownload).
3. While a check runs, the bell shows a quiet "Checking song sources…" entry with Cancel and "Open sync settings" (/settings/songs).
   - Cancel needs a server route, e.g. POST /api/song-sources/updates/cancel → worker.terminate() in songUpdatesRunner.ts. Add it to OpenAPI (openapi/paths/song-sources.ts).
4. No internet: don't start the sync and show no warning. Add a quick reachability probe in runSongUpdatesInWorker (songUpdatesRunner.ts) before starting the worker; per-source errors are already only logged.
5. The setting "Add new songs automatically" (DiscoverySyncSettings.tsx, server app_settings song_sources_auto_update, on by default) is the "sync without approval" switch. When off, the songs notification should open a manual apply step (the Song discovery page); when on, it should open the finished result.
6. The notification shows only the songs that will be or were added or updated, not the "similar" ones; useSongsNotification.ts currently counts newCount, which includes similar. Server side, add the new-only count, e.g. split newCount into fresh/similar in checkSourceForUpdates.ts.
7. The bell leads to a new Notifications page listing every notification, designed like the other pages, with history kept 60 days, then cleaned up.
   - Today: notifications are derived live (useNotifications.ts) and marks live in localStorage (notificationMarks.ts).
   - A history needs storing, likely server side, with a cleanup older than 60 days.
8. The sidebar Notifications entry becomes a regular item like Settings/Feedback (icon + title), placed below Feedback (ui/sidebar/sidebar.tsx; NotificationCenter is rendered above Feedback today).
9. Two e2e failures seen after making similar songs start unticked; not investigated:
   - song-discovery.spec:228: after "Import" the new song's checkbox still exists, toHaveCount(0).
   - song-sources.spec:183: the link URL text shows twice in Settings (strict mode). It may be leftovers in the reused e2e DB from an earlier failed run.
Then: RO strings via Codex, a new video (scratchpad T-120/v2/video-round3.ts + spec3.json, server via start-video-server.sh on 3220), `python3 …/task_pr.py open T-120 --here --body-file <body>` (last body: scratchpad T-120/v2/pr-body3.md), `bun app/scripts/review-build.ts T-120`, and smoke:sidecar.
Useful:
- Test server: scratchpad T-120/v2/start-video-server.sh (fresh DB copy; the startup check runs 30 s after start and takes about 3 min).
- Timing probe: T-120/v2/measure.ts.
- e2e helper: e2e/helpers/song-folder-source.ts.
- 2026-10-06: 2026-10-06: song-sources-3 took over from song-sources-2 (worktree agent-ad9b34d1d4fb9d535, branch task/T-120 at e4f152ca). BEFORE screens: scratchpad T-120/v2/r3-*.png (current build: pop-up, bell, panel, discovery). Plan: notifications history stored on the server (table `notifications`, 60-day cleanup), a Notifications page and a sidebar item under Feedback, styled like Settings; songs wait for approval when sync-without-approval is off (POST /updates/sync), cancel route, offline probe for scheduled runs, a count on "Descarcă cântări". Server side is written; client is next.
- 2026-10-06: 2026-10-06: Progress (song-sources-3). Committed 1101ec84 (server: notifications history, sync on approval, cancel, offline check) and 51b2a664 (a stalled download hung a check forever: in Bun, req.destroy(err) emits no 'error' before the response, so the 60 s timeout never settled the promise; Laudele Domnului hung 10+ min). Client written, not yet committed: Notifications page, sidebar item under Feedback, compact pop-up, count button next to "Descarcă cântări", RO from Codex. Found and fixing a bug in e4f152ca: the automatic updates matched library songs by title, so several source songs with one title (e.g. 4 BCEV "ALELUIA ALELUIA") overwrote the same library song on every run. A second forced run updated 607 songs again. Fix: update only a library song from the same file, claimed by a single source song; verifying with two runs on a fresh DB.
- 2026-10-06: User (2026-10-06): "in https://github.com/radio-crestin/church-hub/releases/tag/song-sources make sure to say bcev-baicoi-opensong.zip". => On the song-sources release, the plain OpenSong zip asset is named bcev-baicoi-opensong.zip (and the same "<source>-opensong.zip" pattern for the other categories), so it's clear it holds OpenSong files. Update the builder, the Resurse Creștine workflow, the source configs/links and the release assets to match; remove the old-named assets.
- 2026-10-06: 2026-10-06: Done (song-sources-3): the user's requests of this round are in, and so is the opensong zip rename. The PR, video and review app are updated.
Video: [T-120.mp4](../tasks_videos/T-120.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/159
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-120/church-hub-T-120.app
Commits on task/T-120 (on top of e4f152ca):
- 1101ec84: server.
  - A `notifications` table and /api/notifications (list, read, app-update, delete), cleaned up after 60 days, at start and daily.
  - Songs wait for approval when syncing without approval is off: POST /updates/sync. Also /updates/cancel and /:id/recount (replaces new-count).
  - New, similar and changed songs are counted apart.
  - Scheduled checks start only when https://github.com answers.
- 51b2a664 (fix): a stalled download hung a check forever. In Bun, req.destroy(err) emits no 'error' before the response, so timeouts now reject directly (60 s idle, 5 min in all).
- 59e01bd6 (fix, a bug from e4f152ca): updates were also matched by title, so several source songs with one title overwrote the same library song on every run (a second forced run updated 607). Now only a library song from the same file, claimed by one source song, is updated. On a fresh v0.1.103 library: run 1 adds 177 and updates 13, run 2 changes nothing.
- da2a383c, 2d686682: client.
  - A Notifications page, opened from a sidebar item under Feedback (styled like Settings, with the unread count).
  - The running check shows only there, with Cancel and Sync settings.
  - Finished results pop up once in a compact form, as the lead confirmed.
  - The "waiting for approval" card has Sync now / Review / Sync settings; the app update card has Download / Install (desktop) or See what's new.
  - "Descarcă cântări" no longer animates; when songs wait, a small button with the count syncs them.
  - The setting is "Sincronizează automat cântările noi și actualizările", with a hint.
  - The bell panel and the localStorage marks are removed. Fixed: deleting a notification failed, because its encoded id didn't match the route.
- 2cab47bc: the pending notification is recorded once per check, so it pops up once.
- a953a5a0 + release: the plain zips are `<source>-opensong.zip` (builder and RC workflow). On the song-sources release the four new zips are uploaded, the old `<source>.zip` deleted and the notes updated: https://github.com/radio-crestin/church-hub/releases/tag/song-sources
Checks:
- e2e: notifications.spec (new, 5) and song-updates.spec (3), plus 42 in song-discovery*, song-sources, song-source-links-private-network, song-formatting-tags, file-drop-import, song-import-export, app-update. All pass.
- smoke:sidecar: all 10 checks.
- By hand on 3220: Cancel; a 61-day-old notification deleted at start; offline, the scheduled check logs and doesn't start; the phone layout.
- RO by Codex.
Not checked:
- The review desktop app by hand (project rule: Playwright only).
- The Download/Install buttons of the app update card: only the desktop updater has an update to install, so the browser shows "See what's new".
- A manual "Check now" while offline still runs and shows per-source errors. Only the scheduled checks are skipped, so e2e doesn't depend on the internet.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/159
Release: https://github.com/radio-crestin/church-hub/releases/tag/song-sources
T-120 Song sources: config files, your own S3, shareable
New songs and updates now sync on their own (a song you edited is never replaced); a switch in Settings > Songs makes them wait for your approval, and then a small button next to "Descarcă cântări" syncs them. A new "Notificări" item under Feedback opens a page with every notification of the last 60 days, the running check (with Cancel) and app updates. On the release, the plain zips are now named like bcev-baicoi-opensong.zip.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: Finished (song-sources-3): PR #159 is ready for review, rebased on main (1d8a585f) with no conflicts, head a2229abb. https://github.com/radio-crestin/church-hub/pull/159
Added at the finish:
- f6fc836b: lint (format).
- 449ddb9e: a check asked for while another runs (a link just added, a second "Check now") was dropped; it now runs right after, and Cancel drops it. e2e case in song-updates.spec; it fails on the old runner.
- ee13e567: the song source specs (notifications, song-updates, song-discovery, song-formatting-tags, song-sources) delete the categories their imports create, first in afterAll. They had leaked 81 into my test DB and shifted search priorities. I also deleted those and reset all priorities to 1 in my test DB, as T-126 suggested.
- a2229abb: importing songs no longer rebuilds the whole search index afterwards. /api/songs/batch already indexes what it imports, and the rebuild took 20+ s on a large library. This was the song-discovery.spec flake: Import kept spinning.
Checks:
- Full suite (CI=1, --workers=1 --retries=2) on the final branch: 803 passed, 34 skipped, 0 flaky, 1 failed: shortcut-scopes.spec.ts:252, which fails the same on plain origin/main (reported to the lead).
- Lint clean; smoke:sidecar all 10 checks pass; review app rebuilt.
- 2026-10-06: Song sources (BCEV, LD, PDC, RC configs; release archives as .chsongs + <source>-opensong.zip with checksums; daily RC workflow), .chsongs files, S3 sharing by public link, automatic sync off the UI thread (approval switch, offline-quiet), Notificări page with 60-day history, redesigned Song discovery. Merged PR #159.
