# Cloud sync spike (T-170): the server's service layer on sqlite-wasm + OPFS

Step 1 of `docs/design/cloud-sync-and-shared-library.md` (T-072). The page runs the server's own
code (migrations, the Drive sync engine's adopt/merge/apply, songs list, search with FTS5 and
`normalizeForIndex`, a song edit) in a Web Worker on `@sqlite.org/sqlite-wasm` with the
`opfs-sahpool` VFS (no COOP/COEP headers needed), and measures it.

## How it works
- `src/worker/bunSqliteShim.ts`: the part of `bun:sqlite` the server uses (`query`, `prepare`,
  `run`, `exec`, `transaction`, statements' `all/get/run/values`), on sqlite-wasm's synchronous
  oo1 API. In a worker, sqlite-wasm is synchronous, so the server's synchronous code and drizzle's
  `bun-sqlite` driver run on it **unchanged**: no async rewrite.
- `vite.config.ts` (`serverInBrowser` plugin): `bun:sqlite` → the shim, `node:crypto` → a sync shim
  on `@noble/hashes`, `db/connection.ts` → `browserConnection.ts`, `db/fixtures/readFixtureFile.ts`
  → no fixtures (a phone seeds no songs or Bibles), other Node built-ins and `posthog-node` → stubs
  that record the calls made (reported in `stubCalls`). Nothing else in the server is replaced.
- `src/worker/bench.worker.ts`: the bench. `?snapshot=<file>&mode=<mode>` runs it on load.
  Modes for the first sync: `direct` (unchanged code on OPFS), `one-tx` (wrapped in one outer
  transaction), `memory-import` (default: build in memory, `importDb` into OPFS, reopen),
  `memory` (in memory only, the baseline). No `snapshot` = reopen (an app start after a sync).
- `scripts/buildSnapshots.ts`: gzipped LibraryFile snapshots from a real app.db, with the server's
  own `serializeLibrary`. `scripts/serve.ts`: serves the page, the snapshots, and saves each
  device's results (POST `./results`).

## Run it
```sh
cd app
bun spikes/cloud-sync/scripts/buildSnapshots.ts <app.db> $TMPDIR/snapshots 26386 3000 300
SPIKE_BASE=$SF_PREVIEW_BASE SPIKE_OUT=$TMPDIR/spike-dist bunx vite build -c spikes/cloud-sync/vite.config.ts
SPIKE_BASE=$SF_PREVIEW_BASE bun spikes/cloud-sync/scripts/serve.ts $PORT $TMPDIR/spike-dist $TMPDIR/snapshots $TMPDIR/results
```
Then open the preview on a phone (iOS Safari, Android Chrome) and tap a button. A Playwright run
needs a **persistent** context (`launchPersistentContext`): an incognito context keeps OPFS in
memory, and every write there costs 25+ ms, which measures Chromium's incognito storage instead
of the device.

## Status (2026-11-22, moved to another machine mid-spike)
Done:
- Everything above builds and runs in headless Chromium (Linux VM, persistent profile). Search
  finds songs without diacritics, an edit is found by the next search, and the sync triggers queue
  the edit in `sync_pending`.
- Bundle: the worker JS (the server's code included) is 622 KB raw / **175 KB gzipped**;
  `sqlite3.wasm` 879 KB / **406 KB gzipped**. Unused by this page, the npm package also emits
  `sqlite3-worker1` and `sqlite3-opfs-async-proxy` (not loaded).
- Snapshots from a real 26,386-song library: **9.3 MB gzipped** (51.5 MB raw, about 1.95 KB per
  song, not the 1.3 KB the design assumed); 3,000 songs **1.1 MB**; 300 songs 0.12 MB.
- Stubs actually called at run time: `node:path.join`, `node:fs.existsSync/mkdirSync` (fileLogger),
  `node:os.hostname` (add-sync's default device name), `new PostHog`. All harmless.

Numbers so far (headless Chromium 147, 16-core VM, persistent profile):

| | 300 songs | 3,000 songs |
|---|---|---|
| wasm init + OPFS VFS install | ~110 + ~95 ms | same |
| migrations on a fresh db, OPFS (`direct`) | 5.6–8.7 s | 3.0 s (`one-tx` run) |
| migrations in memory (`memory-import`) | 0.9 s | 0.45 s |
| apply the snapshot (adopt + merge + apply), OPFS `direct` | 4.8–5.9 s | not run |
| same, in memory | 0.97 s | **7.8 s** |
| FTS5 rebuild (`rebuildSearchIndex`) | 0.3–1.2 s | 1.3–1.5 s |
| search (8 queries, median of 5 each, cache cleared) | 30–55 ms median | 96–105 ms median, max 230 |
| list first page | 20–90 ms | 30 ms |
| song edit (`upsertSong`) + reindex one song | 65–170 + 18–35 ms | 52 + 13 ms |
| one autocommit write on OPFS | 6–10 ms | 5–8 ms |
| db file | 3 MB | 15.8 MB |

Findings so far:
1. The service layer runs **unchanged** through the shim. Swapped: one file (`db/connection.ts`)
   plus the seed fixtures, two `node:crypto` calls shimmed, telemetry stubbed.
2. On OPFS every autocommit write costs 5–10 ms, whatever the pragmas (synchronous OFF, exclusive
   locking, MEMORY journal: no clear gain). The server's code makes many autocommits: ~40 migration
   steps, and `applyRemoteChanges` refreshes each song's FTS row **outside** its transaction
   (`service/sync/applyRemoteChanges.ts`, the `updateSearchIndex` loop). So the first sync should be
   built in memory and written to OPFS in one `importDb` (`memory-import`), or the FTS refresh moved
   into the transaction (`batchUpdateSearchIndex`).
3. At 3,000 songs the apply step takes 7.8 s **even in memory**: the cost is in the JS sync path
   (adopt/merge/apply), not OPFS. Next: profile it (suspect per-song lookups by uuid, or
   adoptRemoteIdentities scanning), and compare with the same code natively in Bun.

Next steps:
- Profile the apply at 3,000 songs; run 26k (memory-import), WebKit, and a reopen (app start).
- Real phones: register the preview, ask the user to open it on iOS Safari and Android Chrome.
- S3 (scope cut by the lead: the sync service is now the only writer, so no conditional PUT):
  only check public read without listing, on a local S3 server. MinIO stopped publishing binaries
  and images in Oct 2025 (Docker Hub denied, `dl.min.io` 410); `pgsty/minio` (a community build,
  RELEASE.2026-08-04) works. The bucket policy that allows `s3:GetObject` on `churches/*` and
  `libraries/*` only was set with `pgsty/mc anonymous set-json`.
- The report on the task, and the design doc's §8–9 numbers (on T-072's branch, PR #199).
