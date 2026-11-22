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
# headless, persistent profile (Node: Playwright's pipe hangs under Bun on Windows)
node spikes/cloud-sync/scripts/runBench.ts http://127.0.0.1:$PORT$SF_PREVIEW_BASE chromium <profile-dir> \
  snapshot-3000.json.gz:memory-import :reopen snapshot-26k.json.gz:memory-import :reopen
# the same first sync on Bun, step by step (no fixtures, as on a phone)
bun spikes/cloud-sync/scripts/profileApply.ts $TMPDIR/snapshots/snapshot-3000.json.gz <work-dir>
```
- On a phone (iOS Safari, Android Chrome): open the preview and tap a button; results are saved by
  `serve.ts`.
- A Playwright run needs a **persistent** context: an incognito one keeps OPFS in memory, and every
  write there costs 25+ ms (it measures Chromium's incognito storage, not the device).
- In Git Bash on Windows, prefix with `MSYS_NO_PATHCONV=1`, or `/preview/...` becomes a Windows path.
- Playwright's WebKit on Windows has no OPFS ("Missing required OPFS APIs"): Safari needs a Mac or
  an iPhone.
- `scripts/publicRead.py <endpoint>` (boto3, `S3_ACCESS_KEY`/`S3_SECRET_KEY`): public read without
  listing on any S3 server.

## Results (2026-11-23)
The design doc's section 8 has the summary. Detail:

- **Unchanged code**: everything above runs the server's modules as they are. Stubs called at run
  time: `node:path.join`, `node:fs.existsSync/mkdirSync/appendFileSync` (fileLogger),
  `node:os.hostname`, `new PostHog` (+ `captureException`). All harmless.
- **Bundle**: worker JS (the server's code included) 622 KB raw / **175 KB gzipped**;
  `sqlite3.wasm` 879 KB / **406 KB gzipped**.
- **Snapshots** from a real 26,386-song library: **9.47 MB gzipped** (51.8 MB raw, ~1.95 KB per
  song); 3,000 songs 1.1 MB; 300 songs 0.11 MB.

Headless Chromium 147, tibi-pc (12 threads), persistent profile, `memory-import`:

| | 3,000 songs | 26,386 songs |
|---|---|---|
| total, tap to searchable | 3.7 s | 18.3 s |
| wasm init / migrations in memory | 36 ms / 0.16 s | 27 ms / 0.14 s |
| download / gunzip + parse | 7 / 46 ms | 49 / 335 ms |
| apply (adopt + merge + apply, FTS included) | 1.1 s | 9.8 s |
| FTS5 rebuild (measured separately) | 0.37 s | 3.9 s |
| `importDb` into OPFS / db size | 39 ms / 13.5 MB | 0.3 s / 94.8 MB |
| wasm heap | 25 MB | 157 MB |
| reopen (app start: open + migrations + queries) | 2.3 s | 4.1 s |
| search, 8 queries, median / max | 34 / 64 ms | 74 / 94 ms |
| list first page / song edit | 4 / 40 ms | 7 / 32 ms |

`direct` (the unchanged code straight on OPFS, 3,000 songs): 5.3 s, of which migrations 1.8 s:
each autocommit on OPFS costs 3–10 ms, so the first sync is built in memory (`memory-import`).

The same first sync on Bun (`profileApply.ts`), before → after this spike's fixes:

| | 3,000 songs | 26,386 songs |
|---|---|---|
| apply | 12.4 s → 1.3 s | 50.8 s → 9.7 s |

1. `applyRemoteChanges` re-indexed each synced song alone; `songs_fts.song_id` is UNINDEXED, so
   each DELETE scanned the index (10 of the 12.4 s). Now in batches of 500
   (`batchUpdateSearchIndex`).
2. Bun's `db.query()` cache holds 20 SQL strings and never evicts: the migrations fill it, and every
   later query is prepared again (10 s at 26k). `db/connection.ts` raises it to 1,000.
3. The batch's slide query sorted every slide of the library per batch and lost the slide order;
   main fixed it the same way meanwhile (T-153, `songIndexRowsSql.ts`).

Public read without listing (`publicRead.py`, SeaweedFS 4.54): a standard AWS bucket policy with
anonymous `s3:GetObject` on `churches/*` and `libraries/*` only: GET there 200, elsewhere 403,
ListObjectsV2 403 with or without a prefix. MinIO stopped publishing binaries and images in Oct
2025; `pgsty/minio` (a community build) works on Linux and macOS.

Not measured: real phones (asked on the task), Safari, D1 latency (T-171 deploys the service).
