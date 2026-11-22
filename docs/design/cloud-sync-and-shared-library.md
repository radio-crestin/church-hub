# Cloud sync and a shared song library (T-072): design and decisions

Status: **proposal, waiting on the user's decisions** (section 9). No code until they are made.

## 1. What is asked

From the user (05/10):
- Phones and the computer stay in sync **even while the church computer is off**.
- The infrastructure is **cheap and serverless**: S3/R2 plus Cloudflare Workers.
- **A curated song library that we manage**, fed by songs users submit.
- **Churches can share their songs** with each other.
- **Deduplication on every client**, and **a local edit is never overwritten**. This is the same rule as the Resurse Crestine import (T-035), and any client can import shared sets that way.
- Storage is **protected** (auth, access per church) and **compressed**.
- **SQLite in the browser**, with a small, fast download and fast full-text search.

## 2. What already exists, and what we reuse

| Piece | Where | Reuse |
|---|---|---|
| **Library sync engine**: uuids on songs, categories, groups and schedules; SQLite triggers fill `sync_pending` and `sync_tombstones`; last-writer-wins merge per aggregate; conflict feed | `app/apps/server/src/service/sync/*`, `db/migrations/add-sync.ts` | **Kept whole.** Only the transport changes: today it uploads one gzipped JSON file to Google Drive (`driveLibraryFile.ts`); the new transport is a change log in the cloud. |
| **Song sources (T-120)**: the `.chsongs` bundle, a manifest with a hash per song, publish to an S3 bucket, subscribe by URL | `service/song-sources/*` | **The format of every shared library**: the curated one, a church's shared set and Resurse Crestine all become sources. |
| **Discovery matching (T-035/T-124)**: matches by exact filename, then exact title, then fuzzy (Jaccard ≥ 0.55); updates only songs with `last_manual_edit` NULL; review screen with a lyrics diff | `service/songs/discovery.ts`, `service/song-sources/updates/*`, `SongDiscoveryScreen.tsx` | **The one import path** for every source, on desktop and phone alike. |
| **FTS5** with `unicode61 remove_diacritics 2`, plus `normalizeForIndex` (Romanian contractions) | `db/fts.ts`, `service/songs/search.ts` | The same table and normalizer run in the browser, so search gives the same results on the phone. |
| **Accounts, roles, LAN pairing code (T-167)** | `db/schema/auth.ts`, `service/users/login-pairing.ts` | Pairing also hands a phone its cloud device token (and the church key, see D2). |
| **Cloudflare Worker** `churchhub-backend` (Hono; R2, KV, rate limiter; crypto helpers) | `churchhub-backend/` | Gets the new routes. It has no database or accounts yet; those are new. |

Measured on a real library: 27,320 songs come to **about 1.3 KB of raw data per song**, or about 4 KB counting the FTS index. A typical church keeps 500 to 3,000 songs, so **0.6 to 4 MB raw, and about 0.2 to 1 MB gzipped**.

## 3. The two options

### Option A (recommended): Workers + Durable Objects + R2, with SQLite (wasm) in the browser

```
 Church PC (Bun + SQLite)        Phone / tablet (PWA or T-050 app)
 sync_pending ─┐                 ┌─ sqlite-wasm + OPFS, the same FTS5
               │  push / pull    │
               ▼                 ▼
       Cloudflare Worker  (auth: device token → church)
          │                       │
  Durable Object per church    R2 bucket (private)
  (SQLite: ordered change      snapshots/<church>/<seq>.gz
   log, cursors per device)    library/<source>/shards/<hash>.gz
```

- **One Durable Object per church** keeps an ordered change log: `seq, entity, uuid, updatedAt, deviceId, payload` (gzipped, and encrypted if D2 says so). A device **pushes** its `sync_pending` rows and **pulls** everything after its cursor. The DO only orders and stores; the **merge stays on the client** in the existing `mergeLibraries.ts` (last writer wins per aggregate, tombstones), so the PC and the phone behave the same.
- **Compaction**: every N changes (or nightly) a client uploads a full **snapshot** to R2 and the DO cuts the log before it. A new device downloads the snapshot (one gzipped file) and then the tail of the log.
- **Live updates**: a hibernating WebSocket on the DO, so a change on one phone reaches the others within a second, and an idle connection costs nothing.
- **The PC can be off**: phones talk only to the cloud. When the PC comes back, it pulls what they did.
- **Browser**: the official `@sqlite.org/sqlite-wasm` build (it includes FTS5) on **OPFS** in a Web Worker. The wasm is about 0.9 MB, **about 0.4 MB compressed**, and cached by the service worker after the first load. The schema and `normalizeForIndex` are shared code, so FTS5 answers in milliseconds, offline.
- **Cost**: Workers Paid is $5 a month for the whole account. It includes 10M requests and the Durable Objects with SQLite storage; R2 has no egress fees and its first 10 GB are free. **Hundreds of churches fit in about $5 a month**, and the free plan is enough for a pilot. These are Cloudflare's list prices; recheck them when we build.

### Option B: Electric + PGlite (Postgres and shapes)

```
 Postgres (Neon / Supabase)  ──logical replication──►  Electric service (always on)
        ▲  writes go through our own API                    │ shapes over HTTP (CDN-cacheable)
        │                                                    ▼
 Church PC and phones ◄─────────────────────────────── PGlite (Postgres in wasm)
```

- Electric streams **reads only**. Writes still need an API of our own, plus the logic to resolve conflicts.
- Running it means a Postgres database and an Electric service that is always on: Electric Cloud, or a VM. A Postgres database is free at small scale, then about $19 a month; the service is $5 to $20 a month or more, before any write API.
- **PGlite is about 3 MB compressed**, 7 times sqlite-wasm. It also means a second schema, in Postgres, next to our SQLite schema on the desktop, with FTS rebuilt on `tsvector`. That gives different ranking from the desktop, and our Romanian normalizer would have to be ported.
- The Drive sync engine and its merge would be thrown away instead of reused.

### Side by side

| | **A: Workers + DO + R2 + sqlite-wasm** | **B: Electric + PGlite** |
|---|---|---|
| Monthly cost | about $0 (free plan) to $5 for everyone | about $25 to $45 or more, and it grows with the database |
| Servers to keep running | none (serverless) | Postgres + Electric service + write API |
| PC offline | phones sync through the cloud | same |
| Phone offline (no internet) | full read, search and edit; pushes later | reads from PGlite; writes need the custom queue |
| Browser download | about 0.4 MB engine + about 0.2 to 1 MB data | about 3 MB engine + data |
| Full-text search | FTS5, same tokenizer and normalizer as the desktop, so same results | Postgres `tsvector`: different ranking, normalizer ported |
| Dedup and no overwrite of local edits | existing `discovery.ts` + `last_manual_edit`, reused | to rewrite for Postgres |
| End-to-end encryption possible | yes (the DO stores opaque blobs) | no (Electric must read the rows) |
| Code reused | sync engine, merge, song sources, FTS | little |

**Recommendation: A.** It is what the user asked for (S3/R2 + Workers, SQLite in the browser). It is about 10 times cheaper, has no server to look after, keeps a single schema and search engine, and reuses the sync engine we already have. Electric's strength, streaming shapes out of a big shared Postgres database, is not something we need.

## 4. Protection

- **Identity**: the church PC **registers the church** with the Worker once (the Super Admin presses "Turn on cloud sync"). It gets a `churchId` and a device token. Each phone paired through the T-167 code (or a QR code shown on the PC) gets **its own device token**, which the PC can revoke from Settings. The tokens are random 256-bit values, and the Worker stores only their hashes (HMAC, as `hashClientIp.ts` does).
- **Per-church access**: the Worker maps token → church → that church's Durable Object and its R2 prefix. The bucket is private, so nothing in it is reachable without the Worker.
- **Encryption** (decision D2): by default, the payloads are **encrypted on the client** with a church key (AES-256-GCM, through WebCrypto) that goes from device to device with the pairing QR code. Cloudflare and we only ever see ciphertext. Losing every device means losing the cloud copy, but the PC keeps its local database, and a printable recovery key is offered.
- **Abuse**: the rate limiter and KV quotas already in the Worker; size caps per church.

## 5. Compression and download size

- **Sync payloads and snapshots**: gzip, through `CompressionStream` / `DecompressionStream`, which is native in browsers, Bun and Workers, so no extra library is needed. Lyrics shrink to about 25 to 30 %.
- **Libraries** (curated, shared): the existing manifest + songs, split into **shards of about 500 songs**, each named by its content hash (`shards/<sha256>.gz`). The files never change, so they cache forever. An update downloads only the shards whose hash changed.
- **The curated catalog** at Resurse Crestine size (27k songs) is about **7 MB gzipped**. A phone downloads it only when the user turns on "the whole catalog offline". Otherwise it searches a **titles + first line index of about 1 MB** and fetches the shard of a song when it is opened.
- **FTS index**: built on the device in a Web Worker, from the shards. It is not downloaded: that is 3 times smaller to fetch, and it takes about 1 to 3 s for 27k songs (to measure in the spike).

## 6. The shared song library

- **Everything is a song source** (the T-120 format), hosted on our R2 behind the Worker:
  - **The Church Hub Library** (curated): public to read, and we write to it.
  - **A church's shared set**: a church publishes its whole library or chosen categories, as *public* (listed in the catalog), *unlisted* (anyone with the link) or *private* (named churches). This replaces T-120's "bring your own S3 keys" with a single button; your own S3 bucket stays an option.
  - **Resurse Crestine**: unchanged.
- **Submissions**: "Submit to the Church Hub Library" on a song sends it to a **moderation queue** (a Durable Object + R2). Our curators (a new `library_curator` role in the cloud) review it in a page of the app: approve, merge into an existing song, or reject. On approval the shard is rebuilt and the manifest is bumped.
- **Importing** goes through the one existing path (T-035), for every source, on every client:
  1. **Dedup** (client side): exact match by source song id, then by **content fingerprint** (new: sha256 of the normalized lyrics), then exact title, then fuzzy (Jaccard). A match is linked, not duplicated.
  2. **Never overwrite a local edit**: a song is updated from its source only when `last_manual_edit` is NULL **and** its current content hash still equals the `source_hash` saved at import. That second check is new; it also catches edits made before `last_manual_edit` existed. An edited song gets a "new version available" badge (with the existing lyrics diff) and is never replaced silently.
  3. **Review mode or auto-apply**, per source, as T-035 does.
- New columns on `songs`: `source_id`, `source_song_id`, `source_hash`, `content_hash`. They are local and are not synced as content.

## 7. Phones while the PC is off

The phone's client is served by the PC's sidecar today, so **with the PC off the app itself doesn't load**. The fix:
- The same React client, **built as a PWA and hosted on Cloudflare Pages** (`app.<domain>`), with a service worker so it opens offline. Later, the T-050 native apps wrap the same build.
- In "cloud mode" the client's data layer talks to the sqlite-wasm database (a data adapter with the same API as the server routes) instead of the sidecar. When the PC is reachable on the LAN, the phone keeps using it directly, as it does now.
- Scope (decision D3): by default, **songs, categories, schedules and the Bible** (read-only, bundled about 11 MB per translation, downloaded on demand) **can be read, searched and edited**. Presenting, screens, OBS and the livestream stay on the PC.

## 8. Plan, once approved (each step a task with its own e2e)

1. **Spike** (about 1 day): sqlite-wasm + OPFS + our FTS5 on a phone. Measure the bundle size, the index build time for 27k songs, and the search latency. A DO change log on the free plan.
2. **Cloud transport**: Worker routes + a Durable Object per church; `runSyncCycle` gets a `cloud` transport next to `drive`; device tokens and church registration; pairing hands a phone its token (and key).
3. **Encryption** of the payloads (if D2 = yes) + the recovery key.
4. **PWA on Cloudflare Pages** + the sqlite-wasm data adapter for songs, schedules and search.
5. **Library sources on R2**: content-hash shards, fingerprints and `source_hash`, a church's "Share my songs" button.
6. **Curated library**: submission, moderation queue, curator page.
7. **Retire Drive sync**, or keep it (decision D4).

## 9. Decisions for the user

| # | Decision | Recommended |
|---|---|---|
| **D1** | Architecture: A (Workers + DO + R2 + sqlite-wasm) or B (Electric + PGlite) | **A** |
| **D2** | Encrypt church data on the client, so Cloudflare and we never see it? | **Yes**, the key travels with pairing, plus a recovery key |
| **D3** | What a phone can do with the PC off | **Songs + schedules: read, search, edit; Bible: read**; presenting stays on the PC |
| **D4** | Google Drive sync, once cloud sync works | **Keep it as a backup option**, and make cloud sync the default |

Details with good defaults, unless the user wants otherwise:
- Curators: us (the project team) at the start, with a cloud role we can hand out later.
- A church's shared set: unlisted by default; the church chooses public.
- Domain: under the existing `radiocrestin.ro` Worker domain, or a new one if the user prefers.
