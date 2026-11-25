# Cloud sync and a shared song library (T-072): design

Status: **design decided and approved by the user on 2026-11-22, revised after their review** (section 11). Implementation is split into tasks (section 10).

## 1. What is asked

From the user (05/10):
- Phones and the computer stay in sync **even while the church computer is off**.
- The infrastructure is **cheap and serverless**: S3 and Cloudflare Workers.
- **A curated song library that we manage**, fed by songs users submit.
- **Churches can share their songs** with each other.
- **Deduplication on every client**, and **a local edit is never overwritten**. This is the same rule as the Resurse Crestine import (T-035), and any client can import shared sets that way.
- Storage is **protected** and **compressed**.
- **SQLite in the browser**, with a small, fast download and fast full-text search.

The user's decisions on the first proposal (22/11):
- **D1, architecture**: «workers charge per request.. so implement something which will be very simple and usually work with any s3 compatible storage.. also implement webrtc communication between clients and the main server when it's online.. also a qr code or link to be opened.. separate task to build mobile native apps and also a public page and when joined with the token then it's binded to that server.. some hono service through which the server will upload and sync differences and the clients will also sync things through it but the read will happen directly from the s3».
- **D2, encryption**: no client-side encryption; token protection is enough.
- **D3, a phone with the PC off**: **everything, full control**.
- **D4, Google Drive sync**: kept as a backup option; cloud sync is the default.

## 2. What already exists, and what we reuse

| Piece | Where | Reuse |
|---|---|---|
| **Library sync engine**: uuids on songs, categories, groups and schedules; SQLite triggers fill `sync_pending` and `sync_tombstones`; last-writer-wins merge per aggregate; conflict feed | `app/apps/server/src/service/sync/*`, `db/migrations/add-sync.ts` | **Kept whole.** It gets a second transport, `s3`, next to `drive`, and is extended to every table (D3). |
| **Song sources (T-120)**: the `.chsongs` bundle, a manifest with a hash per song, publish to any S3 endpoint with Bun's `S3Client` | `service/song-sources/*` | **The format of every shared library**, and the S3 code. |
| **Discovery matching (T-035/T-124)**: matches by exact filename, then exact title, then fuzzy (Jaccard ≥ 0.55); updates only songs with `last_manual_edit` NULL; review screen with a lyrics diff | `service/songs/discovery.ts`, `service/song-sources/updates/*` | **The one import path** for every source, on every client. |
| **FTS5** with `unicode61 remove_diacritics 2`, plus `normalizeForIndex` | `db/fts.ts`, `service/songs/search.ts` | The same table and normalizer in the browser. |
| **Accounts, roles, LAN pairing code (T-167)** | `db/schema/auth.ts`, `service/users/login-pairing.ts` | A device token is bound to a user, so their permissions apply. |
| **`churchhub-backend`**: a Hono app on a Worker, with WebRTC signaling (`/signal/*`, KV) already used by live translation | `churchhub-backend/` | **Hosts the sync service** (Hono runs on Workers, Bun and Node alike) and the **WebRTC signaling** to the PC. |

Measured on a real library: 27,320 songs come to **about 1.3 KB of raw data per song**. A typical church keeps 500 to 3,000 songs, so **0.6 to 4 MB raw, and about 0.2 to 1 MB gzipped**.

## 3. The design in one picture

The user's review (22/11): «make sure that each client can modify only what's allowed to modify.. so keep the state somehow centrally and by one update things are updated quick and the backend will verify if the user really has access to modify that».

```
            PC online: live, direct                     PC off
 Phone ──── LAN WebSocket or WebRTC ──── Church PC      Phone
   │        (signaling via /signal)        │              │
   │                                       │ every write  │ every write
   │                                       ▼              ▼
   │                     Hono sync service: THE ONE WRITER, checks every change
   │                       central state (D1 / SQLite): users, roles, permissions,
   │                       devices, the version of every row, the church's seq
   │                                       │ accepted changes → one segment
   │  reads: GET directly (secret path)    ▼
   └─────────────────────────────► any S3-compatible bucket (R2, B2, AWS S3, MinIO…)
                                    public read, no listing
```

- **The state is kept centrally**, in the Hono sync service. It is the **only writer** for every church: the PC and the phones alike send their changes to it, and **nothing reaches the bucket without passing its permission check**.
- **One update, everyone sees it quickly**. A single `POST` is checked, versioned and published as one segment in the bucket. Every client picks it up on its next `head.json` poll, every few seconds while the app is open (an unchanged head costs a 304). Phones on the PC's LAN or WebRTC also get it live from the PC.
- **The PC is still the hub while it is on**: phones talk to it directly, on the LAN or over **WebRTC** (signaling through the existing `/signal` routes), as today. Even then, its writes go through the service, so the central state and the bucket are always current.
- **With the PC off**, phones keep full control (D3). They read directly from the bucket, and write through the same service, under the same checks.
- **Per-request cost stays small**: the service is called **only for writes**, and reads never touch a Worker. On Cloudflare the central state is **D1** (SQLite: 5M row reads and 100k row writes a day free). Self-hosted, the same Hono app runs on Bun with a SQLite file. Both use the same drizzle schema.
- **Any S3-compatible storage** works, as long as it allows public read without listing. R2 is the default: no egress fees, and the first 10 GB are free.
  - The spike checked it with a standard AWS bucket policy (anonymous `s3:GetObject` on `churches/*` and `libraries/*`, nothing else) on SeaweedFS: anonymous GET there 200, elsewhere 403, listing 403 with or without a prefix (`app/spikes/cloud-sync/scripts/publicRead.py`).
  - For self-hosters: MinIO stopped publishing binaries and images in Oct 2025; SeaweedFS, Garage or a MinIO community build (`pgsty/minio`) work.

## 4. Central state and bucket layout

**Central state** (D1 on Cloudflare, SQLite when self-hosted), one set per church:

| Table | Holds |
|---|---|
| `churches` | `churchId`, `pathSecret`, owner (Google `sub` + email, or none for a guest), `seq` |
| `devices` | an HMAC hash of each device token, its user, its name, when it was revoked |
| `users`, `roles`, `role_permissions`, `user_permissions` | the church's accounts and permissions, the same model as the app's `db/schema/auth.ts`, kept here as the authority once cloud sync is on |
| `entities` | for every synced row: `type`, `uuid`, `version`, `updatedAt`, `updatedBy`, the content hash, and the fields a permission rule needs (for example, the schedule's author) |

The lyrics and other content are not stored in the database; they live in the bucket. The database stays small: about 100 bytes per row.

**Bucket** (public read, no listing):

```
churches/<churchId>-<pathSecret>/head.json          tiny pointer: { seq, snapshot, segments[] }
churches/<churchId>-<pathSecret>/snap/<seq>-<nonce>.json.gz full library at seq (the LibraryFile format the Drive sync already writes, plus every row's version)
churches/<churchId>-<pathSecret>/log/<seq>-<nonce>.json.gz  one accepted write: its changes, versions and author
libraries/<sourceId>/manifest.json     shared and curated libraries (T-120 format), public
libraries/<sourceId>/shards/<hash>.json.gz   about 500 songs each, named by content hash, cached forever
```

**A write** (`POST /sync/:church/changes`, from the PC or a phone) works like this:
1. **Authenticate**: the token's hash is found in `devices` and isn't revoked; that gives the user. The PC's server token may act for the user who made the change on the PC, whom it has already logged in.
2. **Authorize every change**: the user's permissions are mapped from the change, using the same permission keys the app checks today: creating a song, category or group needs `songs.create`, changing one `songs.edit`, deleting one `songs.delete`; schedules need `programs.create`, `programs.edit`, `programs.delete`. A change the user isn't allowed to make is **rejected with 403 and a reason**, and never reaches the bucket.
3. **Check the version**: each change carries the `version` it was based on. If the central version is newer, someone else changed the row first, so the change is answered with **409 and the current version**. The client merges it with the existing `mergeLibraries.ts` (last writer wins per field group, or it asks the user) and sends it again.
4. **Commit**: the segment is written first under a name of its own (`log/<seq>-<nonce>.json.gz`); one transaction then claims `seq + 1` (`UPDATE churches … WHERE seq = <the seq read>`) and bumps the versions, its every statement guarded by that claim. A write that lost the claim to a concurrent one deletes its segment, waits a moment and starts again, re-checking its versions against the winner's. Then `head.json` is rewritten from the central state; a writer re-reads the state after its PUT and writes again if it changed, so the last one always leaves the current head. No conditional PUT is needed, so any S3-compatible storage works.
5. **Answer** with the new versions, so the client marks its pending changes as synced.

- **Roles and users** (T-171): the PC mirrors its roles, users and permissions to the service (`PUT /sync/churches/:church/access`, needs `users.edit`) whenever they change; a row's version goes up when it changed. Editing them from a phone, through the same pipeline, comes with syncing every table (T-173). So the central rules can only be changed by someone allowed to change them.
- **A read**: GET `head.json` straight from the bucket, then only the segments after the device's own `seq`. A new device fetches the snapshot plus the segments after it.
- **Compaction**: every 40 segments (`SYNC_COMPACT_AFTER`; the Workers free plan allows 50 subrequests per request, and compaction reads each segment), or on `POST /sync/churches/:church/compact`, the service writes a new snapshot from the last one plus the segments, points `head.json` at it, and the old segments expire through a bucket lifecycle rule.
- **The PC** (T-171) syncs over the cloud when `sync_config.transport` is `cloud`: it polls `head.json` every 30 s with its ETag (a 304 when unchanged), publishes its edits 2 s after they settle, in chunks of 500 changes (a first sync of 26,000 songs is 53 segments), and keeps each row's central version in `sync_versions`. A 409 makes it pull, merge and send again.
- **Offline phones** (no internet) queue their changes locally, and the UI hides what the user can't do. Once back online, each queued change is checked on arrival like any other; a rejected change is shown to the user and rolled back locally.

## 5. Protection (D2 + Q-5 + review: a secret path for reads, the central check for writes)

- **Reads: a public bucket with a secret per server in the path.**
  - The bucket allows public GET but **no listing**.
  - Each church server lives under `churches/<churchId>-<pathSecret>/`, with `pathSecret` a random 256-bit value (base64url). Knowing the path is the read permission, so **reads never call the service**.
  - The path travels only in the join link's `#` fragment, in the app's local storage and in local backups (section 6). It never goes into a server log or a query string.
- **Writes: only the service writes, and it checks every change** (section 4).
  - Only the service holds the bucket's write keys.
  - Device tokens are bound to a user; the service keeps only their HMAC hashes, as `hashClientIp.ts` does.
- **Revoking a device or a user** (by someone with `users.manage`, on the PC or a phone):
  - Their writes are refused from the next request.
  - Because the device still knows the read path, the service **rotates the path secret**: it writes a fresh snapshot under a new `pathSecret`, and gives the new path to the remaining devices on their next write or check-in (`GET /sync/:church/path`, by token). The old prefix is deleted.
- **Abuse**: the service's rate limiter and size caps per church, as in the feature-request routes.
- Shared and curated libraries are public to read (`libraries/*`, no secret), because they are meant to be shared. Publishing to them goes through the same service and its permission check.

## 6. Owner identity: Google sign-in or guest, kept in local backups

The user (Q-5): «allow the user to login using Google and keep in our backend this reference and also that it's the owner.. but allow also as a guest and later login.. also in local backups make sure to keep this».
- **Turning on cloud sync** on the PC offers two ways:
  - **Continue with Google**: the existing Google OAuth broker in `churchhub-backend` (the one Drive already uses) returns the Google account id (`sub`) and email. The backend stores `church → { ownerGoogleSub, ownerEmail, createdAt }` in the central `churches` table, so that account is **the owner** of that church server.
  - **Continue as a guest**: the church server is created with no owner. The PC can **sign in with Google later** to claim it, and the guest church becomes owned without moving any data.
- **What the owner can do** that a token alone can't:
  - Recover the church on a new or reinstalled PC (sign in, pick the church, get a fresh server token and the current path).
  - Revoke every device and rotate the path.
  - See the church servers they own.
  - Transfer ownership.
- **Local backups keep the cloud identity**: `churchId`, `pathSecret`, the server token and the owner reference go into the app's local backup (`service/backup`). Restoring the backup reconnects the restored PC to the same church server, with no Google sign-in needed.
  - The backup file therefore holds secrets; the backup screen says so.
  - If a backup is restored on a second PC while the first is still active, the server token shows it, and the user is asked which PC keeps the church.

## 7. Joining: a QR code or a link (T-168)

- On the PC, **"Add a device"** shows a QR code and a link: `https://<public app>/join#c=<churchId>-<pathSecret>&t=<deviceToken>&p=<pcSignalId>`.
  - The values sit in the `#` fragment, so they never reach a server log.
  - The device token is minted for the chosen user.
- **The public page** is the same React client, built as a PWA and hosted statically (Cloudflare Pages: free, with no Worker per page view). Opening the link **binds that browser or phone to that church server**. It stores the church, the token and the PC's signal id, and from then on syncs as section 3 describes.
- **Native apps (T-050)** wrap the same build and open the same link as a deep link.

## 8. A phone with the PC off: full control (D3)

- **Everything that is data** can be read and edited: songs, categories, schedules, the Bible, settings, users and roles, bookmarks, tags, playlists.
  - For that, the sync engine is extended from four aggregates to every table, with a `uuid` on the root tables that lack one.
  - The Bible is bundled per translation (about 11 MB, downloaded on demand) and is not synced as changes.
- **How the phone runs it**: the server's service layer runs **in a Web Worker on the phone**, against `@sqlite.org/sqlite-wasm` on OPFS, through drizzle's SQLite driver. The services use drizzle today, so the same code serves the PC and the phone, and nothing is written twice.
  - The wasm engine is about 0.4 MB compressed and cached by the service worker.
  - FTS5 and `normalizeForIndex` give the same search results as the desktop, in milliseconds, offline.
- **Presenting**: a phone can run a presentation and show it on its own screen, or on any display that opens the phone's presenter page. Displays and OBS physically wired to the PC need the PC on.
- **Measured in the spike** (T-170, `app/spikes/cloud-sync/`):
  - **The service layer runs unchanged.** In a Worker, sqlite-wasm's oo1 API is synchronous, so a small shim of `bun:sqlite` on it runs the server's synchronous code and drizzle's `bun-sqlite` driver as they are: no async rewrite. Swapped: `db/connection.ts` and the seed fixtures; shimmed: two `node:crypto` calls; stubbed: telemetry.
  - **Size**: the worker (the server's code included) is 175 KB gzipped, plus 406 KB for `sqlite3.wasm`.
  - **OPFS**: each autocommit costs 3 to 10 ms, whatever the pragmas. So the first sync is built in memory and written to OPFS in one `importDb`; later edits write through OPFS directly (one song edit: 30 to 40 ms).
  - **Times** (headless Chromium 147 on a desktop CPU; not run on phones, which are slower: T-175 measures them on devices):

    | | 3,000 songs | 26,386 songs |
    |---|---|---|
    | first sync, download to searchable | 3.7 s | 18 s |
    | of which applying the snapshot / FTS5 index | 1.1 s / 0.4 s | 9.8 s / 3.9 s |
    | database on OPFS / wasm memory | 13.5 MB / 25 MB | 95 MB / 157 MB |
    | app start after a sync (open + migrations) | 2.3 s | 4.1 s |
    | search, median / max of 8 queries | 34 / 64 ms | 74 / 94 ms |
  - **Fixed on the way**, for the PC too: a synced song was re-indexed one by one, each DELETE scanning the FTS table (`song_id` is UNINDEXED); now in batches of 500. Bun's statement cache (20 SQL strings, never evicted) was full after the migrations, so every later `db.query()` re-prepared; raised to 1,000. A first sync on Bun: 3,000 songs 12.4 → 1.3 s, 26k 50.8 → 9.7 s.
  - A church's own library (hundreds to a few thousand songs) syncs in seconds. The 26k-song catalog takes 18 s even on a desktop CPU, which confirms keeping it in shards loaded on demand (section 9), not in a church's snapshot.

## 9. Compression, download size, the shared library

- **Compression**: gzip everywhere, through `CompressionStream` / `DecompressionStream`, which is native in browsers, Bun and Workers. Lyrics shrink to about 25 to 30 %.
- **A church's first sync**: one snapshot, about 0.37 KB gzipped per song (1.95 KB raw): 1.1 MB for 3,000 songs (measured in the spike). After that, segments of a few KB.
- **The curated catalog** (26k songs, 9.5 MB gzipped as one snapshot) is split into hash-named shards; an update downloads only the shards that changed. The FTS index is built on the device in a Web Worker, not downloaded.
- **Everything shared is a song source** (the T-120 format) under `libraries/`:
  - **The Church Hub Library** (curated by us).
  - **A church's shared set**: the whole library or chosen categories, unlisted by default or listed in the catalog. Publishing goes through the service; the church needs no S3 keys of its own.
  - **Resurse Crestine**: unchanged.
- **Submissions**: "Submit to the Church Hub Library" sends the song through the service to `submissions/` in the bucket. Our curators review it in a page of the app (approve, merge into an existing song, or reject); approving rebuilds the shard.
- **Importing** any source on any client goes through the existing T-035 path:
  1. **Dedup** on the client: by source song id, then by a **lyrics fingerprint** (new: sha256 of the normalized lyrics), then exact title, then fuzzy match. A match is linked, never duplicated.
  2. **Never overwrite a local edit**: a song is updated from its source only when `last_manual_edit` is NULL **and** its content hash still equals the `source_hash` saved at import. Otherwise it gets a "new version available" badge and the lyrics diff.
  3. **Review mode or auto-apply**, per source.
  - New local columns on `songs`: `source_id`, `source_song_id`, `source_hash`, `content_hash`.

## 10. Plan (each step a task with its own e2e)

1. **Spike** (T-170, done; results in section 8):
   - The service layer + drizzle on sqlite-wasm/OPFS in a Web Worker: size, search speed, first sync.
   - Public read without listing, on a local S3 server (section 3). Conditional PUT dropped: the service is the only writer. D1 latency is left to T-171, which deploys the service.
2. **S3 transport + Hono sync service** (T-171):
   - `/sync/*` routes in `churchhub-backend`: register (guest), devices, changes, rotate the path.
   - **The central state** (D1 / SQLite, drizzle): users, roles, permissions, devices, a version per row. **Every change is authorized against the user's permissions and versioned before it is published**; 403 and 409 answers are handled by the client.
   - The `s3` transport in `runSyncCycle` next to `drive`, with the bucket layout and compaction.
   - Drive stays as a backup option (D4).
3. **Owner identity** (T-172): Google sign-in as the owner (recorded in the central `churches` table), guest first and claim later, recovery on a new PC; the cloud identity in local backups.
4. **Sync every table** (T-173, D3): uuids on the remaining root tables, triggers, merge collections, and a version per row for the central check.
5. **Public page + join by QR code or link**, bound to the church server (T-168, together with the native apps of T-050).
6. **WebRTC to the PC when it's online** (T-174) (signaling via `/signal`), next to the LAN WebSocket.
7. **The phone runs the app on sqlite-wasm** (T-175) when the PC is unreachable: full control.
8. **Shared libraries on S3** (T-176): hash-named shards, lyrics fingerprint and `source_hash`, a church's "Share my songs" button.
9. **Curated library** (T-177): submissions, the curator page.

## 11. Decisions

| # | Decision | The user's answer |
|---|---|---|
| D1 | Architecture | Any S3-compatible storage; a small Hono service for writes; reads directly from S3; WebRTC to the PC when it's on; join by QR code or link; a public page and native apps in a separate task |
| D2 | Client-side encryption | No. Q-5: a public-read bucket with a secret per server in the path; tokens for writes |
| Q-5 | Owner identity | Google sign-in, recorded as the owner in our backend; guest first and sign in later; the cloud identity is kept in local backups |
| Review | Who may change what | The state is kept centrally in the sync service, the only writer: every change is checked against the user's permissions and versioned, then published to all clients as one update |
| D3 | A phone with the PC off | Everything, full control |
| D4 | Google Drive sync | Kept as a backup option; cloud is the default |

Details with defaults, unless the user says otherwise:
- **Curators**: the project team at the start.
- **Shared sets**: unlisted by default.
- **The sync service**: a route of `churchhub-backend` (Workers free plan). Anyone can self-host the same Hono app on Bun or Node with their own bucket.
