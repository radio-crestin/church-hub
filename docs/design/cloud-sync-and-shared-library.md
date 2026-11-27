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
   │                       central state (one encrypted object per church in the bucket): users, roles, permissions,
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
- **Per-request cost stays small**: the service is called **only for writes**, and reads never touch a Worker. There is **no database**: each church's central state is one encrypted object in the bucket, changed by compare-and-swap (conditional PUT), so a deploy is the service plus a bucket. Self-hosted, the same Hono app runs on Bun or Node.
- **Any S3-compatible storage** works, as long as it allows public read without listing. R2 is the default: no egress fees, and the first 10 GB are free.
  - The spike checked it with a standard AWS bucket policy (anonymous `s3:GetObject` on `churches/*` and `libraries/*`, nothing else) on SeaweedFS: anonymous GET there 200, elsewhere 403, listing 403 with or without a prefix (`churchhub-backend/scripts/publicRead.py`).
  - For self-hosters: the bucket must support conditional writes (`If-Match` on `PutObject`, section 4): R2, AWS S3 and MinIO do (MinIO stopped publishing binaries and images in Oct 2025: build it from source or use a community build such as `pgsty/minio`). Check any other store for it first.

## 4. Central state and bucket layout

**Central state**: one object per church, `sync-state/<churchId>.bin`, gzipped and sealed with AES-256-GCM under a key derived from the service's `SYNC_SECRET` (the church id bound as associated data). It can sit in the public bucket, unreadable without the secret, or in a private bucket (`S3_STATE_BUCKET`). It holds:

| Field | Holds |
|---|---|
| `pathSecret`, `seq`, `snapshot`, `segments` | where the church is read from, its last write, and what `head.json` lists |
| `devices` | an HMAC hash of each device token, its user, its name, when it was revoked |
| `users`, `roles` (with their permissions) | the church's accounts and permissions, the same model as the app's `db/schema/auth.ts`, kept here as the authority once cloud sync is on; a version per row |
| `versions` | `type:uuid` → the seq that last changed each synced row (negative: deleted) |

The owner (a Google account, through better-auth) comes with T-172. The lyrics and other content are not in the state; they live in the bucket. For a 26k-song library the state is about 0.3-0.4 MB, read and rewritten on each write (10-30 ms per write on Bun).

**Bucket** (public read, no listing):

```
churches/<churchId>-<pathSecret>/head.json          tiny pointer: { seq, snapshot, segments[] }
churches/<churchId>-<pathSecret>/snap/<seq>-<nonce>.json.gz full library at seq (the LibraryFile format the Drive sync already writes, plus every row's version)
churches/<churchId>-<pathSecret>/log/<seq>-<nonce>.json.gz  one accepted write: its changes, versions and author
churches/<churchId>-<pathSecret>/media/index.json        the church's media: { media: { <mediaId>: { hash, size, type } } } (T-215)
churches/<churchId>-<pathSecret>/media/<sha256>          one media file, named by its content, cached forever
libraries/<sourceId>/manifest.json     shared and curated libraries (T-120 format), public
libraries/<sourceId>/shards/<hash>.json.gz   about 500 songs each, named by content hash, cached forever
```

**A write** (`POST /sync/:church/changes`, from the PC or a phone) works like this:
1. **Authenticate**: the token's hash is found in `devices` and isn't revoked; that gives the user. The PC's server token has no user of its own: each change it sends names its `author`, the user who made it on the PC (null: the PC itself).
2. **Authorize every change** against its author, as the church stood before the write or as the changes before it in the batch leave it (a user added earlier may make the next change; a user deactivated later keeps the edits they made before): the user's permissions are mapped from the change, using the same permission keys the app checks today: creating a song, category or group needs `songs.create`, changing one `songs.edit`, deleting one `songs.delete`; schedules need `programs.create`, `programs.edit`, `programs.delete` (T-173 adds the rest: section 8). A change the user isn't allowed to make is **rejected with 403 and a reason**, and never reaches the bucket.
3. **Check the version**: each change carries the `version` it was based on. If the central version is newer, someone else changed the row first, so the change is answered with **409 and the current version**. The client merges it with the existing `mergeLibraries.ts` (last writer wins per field group, or it asks the user) and sends it again.
4. **Commit**: the segment is written first under a name of its own (`log/<seq>-<nonce>.json.gz`); the state, with `seq + 1` and the new versions, is then saved with `If-Match` on the ETag it was read at. A write that lost to a concurrent one (412) deletes its segment, waits a moment and starts again, re-checking its versions against the winner's. Then `head.json` is rewritten from the state; a writer checks the state's ETag after its PUT and writes again from the newer state if it changed, so the last one always leaves the current head. This needs a bucket with conditional writes.
5. **Answer** with the new versions, so the client marks its pending changes as synced.

- **Roles and users** (T-173): they are synced rows like any other (`role`, `user`, with their permissions), written through `POST changes` by the PC or a phone, versioned and checked (`users.create`/`edit`/`delete`; a super admin only by a super admin). The service keeps them as the rules later writes are checked against, so the central rules can only be changed by someone allowed to change them. (T-171 mirrored them with `PUT access`; removed.)
- **A read**: GET `head.json` straight from the bucket, then only the segments after the device's own `seq`. A new device fetches the snapshot plus the segments after it.
- **Compaction**: every 40 segments (`SYNC_COMPACT_AFTER`), or on `POST /sync/churches/:church/compact`, the service writes a new snapshot from the last one plus the segments and points `head.json` at it. It then deletes, by listing its own prefix, the snapshot before last and every segment it covers. A reader still holding the previous `head.json` finds everything that head lists, and no lifecycle rule can delete a segment the current head still lists (with one, a church with fewer than 40 writes in its expiry window would lose segments it still needs).
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
  - **Deactivating or removing a user revokes all their devices at once**; they must be added again to rejoin, even after the user is reactivated. The PC sends the user change right away (T-173: users are synced rows); the service, committing a change that leaves a user inactive or gone, revokes every device of theirs and moves the path in the same state write, whoever made the change (the PC or a phone).
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

**As built (T-172).**
- There is no `churches` table or KV (T-171 keeps each church as one encrypted state object): the owner `{ googleSub, email, claimedAt }` and a pending transfer live in that state, and empty marker objects `sync-owners/<hmac(email)>/<churchId>` list an account's churches.
- The sign-in goes through the sync service (`/sync/owner/sign-in`, scopes `openid email`, the shared Google client). It returns to the PC's loopback callback with a signed owner ticket valid one hour and the nonce the PC issued; the PC refuses any other nonce. The ticket stays in the PC's memory only, never in the database, so a backup can't act as the owner.
- The owner email is kept with the cloud identity (`cloud_sync.owner_email`). A local backup is the whole database file, so it carries the church id, the read URL (with the path secret), the server token and the owner; restoring it reconnects.
- Which PC: each install has an id in a file next to the database (`installation-id`, outside backups) and sends it on every call. The service remembers the installation holding the server token and answers another `409 server_in_use`; that PC stops syncing and asks "keep it on this PC" (takeover) or "let the other PC keep it" (disconnect). The PC checks in every 15 minutes (`GET path`), so an idle PC finds out too, and learns a new path or owner.
- Revoke every device = reset: all tokens revoked (the server's too), a fresh server token for this PC, the path rotated. Recovery revokes only the old server token.
- Transfer is an offer by email; it is the new owner's once that Google account signs in and accepts it.

## 7. Joining: a QR code or a link (T-168)

- On the PC, **"Add a device"** shows a QR code and a link: `https://<public app>/join#c=<churchId>-<pathSecret>&t=<deviceToken>&p=<pcSignalId>`.
  - The values sit in the `#` fragment, so they never reach a server log.
  - The device token is minted for the chosen user.
- **The public page** is the same React client, built as a PWA and hosted statically (Cloudflare Pages: free, with no Worker per page view). Opening the link **binds that browser or phone to that church server**. It stores the church, the token and the PC's signal id, and from then on syncs as section 3 describes.
- **Native apps (T-050)** wrap the same build and open the same link as a deep link.
- **As built (T-168)**:
  - Settings > Phones > *Join with a link*: connect to the cloud (guest), pick the account and a name, get the QR code and link; the device list revokes (`GET /sync/churches/:id/devices` on the service). The link also carries `&s=<service>` when the PC uses a self-hosted service.
  - The public app is `app/apps/client/src/publicApp.tsx` (`features/public-app/`), built by `bun run build:public` into `dist-public/` (vite-plugin-pwa: precached shell, `head.json` network-first, snapshots and segments cache-first). `bun run deploy:public` publishes it to the Pages project `church-hub` (`https://church-hub.pages.dev`, the PC's default; `CHURCH_HUB_PUBLIC_APP_URL` overrides it). Pages serves `index.html` for `/join` (no `404.html`: SPA mode).
  - It needs the service's `ALLOWED_ORIGINS` to list the public app's origin, and the bucket a CORS rule allowing GET from it.
  - Since T-175 the public app is the full app (section 8, "As built (T-175)"); `p` (the PC's remote access room) is where it reaches the PC (T-174).

## 8. A phone with the PC off: full control (D3)

- **Everything that is data** can be read and edited: songs, categories, schedules, the Bible, settings, users and roles, bookmarks, tags, playlists.
  - For that, the sync engine is extended from four aggregates to every table, with a `uuid` on the root tables that lack one.
  - The Bible is bundled per translation (about 11 MB, downloaded on demand) and is not synced as changes.
- **Every table, as built (T-173)**:
  - **Synced** (`service/sync/syncedTables.ts`, in apply order): roles, users (never a login token or password), categories, groups, tags, songs (with their tags and alternate titles), song bookmarks and their notes, Bible bookmarks and their notes (named by translation, book and chapter:verse; this device's ids resolved on arrival), schedules (with their playback settings and the items' timing and sung marks; the control room's queue stays local), music playlists (items named by file path; items whose file isn't on a device are kept for the others), and the church-wide settings on an allow-list (`search_synonyms`, `sidebar_configuration`, `bible_reading_speed`).
  - **Stay on the device**: Bible translations, screens, OBS, YouTube, mixer and MIDI, music files and folders, the live presentation state, histories and caches, every secret (API keys, tokens, OAuth, host keys, `server_secrets`) and per-device choices (theme, language, shortcuts, layout).
  - **Who made it**: each request runs with its signed-in user (`db/actingUser.ts`), written to `sync_state.acting_user` by each write in its own transaction (the row is shared by every connection, a worker thread's too), so the triggers stamp it on `sync_pending` / `sync_tombstones`; each change carries it as `author`. Background work is the PC itself (null). Presenting a song (its count, when last shown) and its background are no edit of it.
  - **The service's answers**: 409 makes the PC pull, merge and send again (an overwritten edit shows as a conflict in the feed); 403 puts the refused change back as the church has it (a row the church never had stays on the PC only, never deleted) and shows it in the feed with the permission it needed, and the rest of the batch goes out on the next round. Reading speed may be set by an operator (`control_room.control`) as well as `settings.edit`, as the app's route allows. Deactivating a user while sync is paused revokes their devices one by one. A user a change deactivates or removes has every device revoked and the path moves.
- **How the phone runs it**: the server's service layer runs **in a Web Worker on the phone**, against `@sqlite.org/sqlite-wasm` on OPFS, through drizzle's SQLite driver. The services use drizzle today, so the same code serves the PC and the phone, and nothing is written twice.
  - The wasm engine is about 0.4 MB compressed and cached by the service worker.
  - FTS5 and `normalizeForIndex` give the same search results as the desktop, in milliseconds, offline.
- **Presenting**: a phone can run a presentation and show it on its own screen (a display window it opens), or on any display that opens the phone's presenter page (that last part over WebRTC: a follow-up task). Displays and OBS physically wired to the PC need the PC on.
- **Media** (T-215): the pictures and videos the church's synced data shows (song backgrounds, which sync since T-215; slides decks and video items in programs) live on the PC.
  - **PC on**: the phone loads them over the WebRTC tunnel. A file travels whole, as base64, so bodies over 64 MiB are refused (413).
  - **PC off**: after each cloud sync, the PC publishes what its data references (`service/cloud-media`, `POST /sync/churches/:id/media`, the server token only).
    - The service lists `media/index.json` and hands out presigned PUTs for missing files, so the bytes go straight to the bucket, around the 8 MiB body cap. It deletes files no longer referenced.
    - Limits: `SYNC_MEDIA_MAX_FILE_BYTES` per file (512 MiB) and `SYNC_MEDIA_MAX_BYTES` per church (2 GiB). Images go first, smallest first.
    - Videos go only when the PC's *Background videos on phones* setting (`cloud_media_videos`) is on; it is off by default.
    - No gzip: every accepted format is already compressed.
    - The phone's server answers a media request with a 307 to the bucket copy, which the public app's service worker keeps (cache-first, range requests) for offline use.
    - Everything sits under the secret prefix: a path rotation leaves the files behind with the old prefix, and the PC, seeing a new read URL, uploads them again.
  - **Unavailable**: a file neither the PC nor the bucket has (a video kept on the PC, the PC unreachable) shows a placeholder: an icon and *Image/Video not available*.
- **As built (T-175)**:
  - **One API**: the server's whole router is one importable fetch handler (`server/src/http/createFetchHandler.ts`). `Bun.serve` runs it on the PC; the browser server (`client/src/features/browser-server/`) runs the same handler in a module Web Worker. `client/browserServerBuild.ts` builds the server's own modules for it: `bun:sqlite`, `node:crypto`, `node:async_hooks` and `node:path` get browser versions, `db/connection.ts` opens sqlite-wasm on OPFS (`opfs-sahpool`), and the rest of Node and the PC-only packages (OBS, MIDI, audio, Google, AI, WebRTC answerer, telemetry) are stand-ins. The worker is 385 KB gzipped (the server's code), plus 407 KB of wasm.
  - **What needs the PC**: its hardware, files and network (OBS, mixer, MIDI, music, screen share, backups, the database file, logs, PowerPoint conversion, remote access, live translation, song sources' checks) answer `503 needs_church_pc` in the browser (`worker/pcOnlyRoutes.ts`), and the web app hides them.
  - **The web app** (`bun run build:public`, any phone or browser) starts like this (`public-app/service/startWebApp.ts`):
    - Joined: the church PC over WebRTC when it answers (T-174); otherwise the church's server in this browser, signed in as the device's user (`GET /sync/churches/:id/device` says whose token it is). It syncs like the PC: the PC's own cloud cycle and scheduler, with the device token. Its first sync reads the snapshot and segments from the bucket into a database built in memory, then saved to OPFS in one `importDb`. The rows a new database seeds for itself are dropped first, unsent.
    - Not joined: a guest, on the library a new PC starts with. The same seed migrations run from the fixtures, which the build ships as gzipped assets (songs 8.5 MB, Bibles 3 MB); it is local only, never synced.
    - Either way, the full app is mounted on a tunnel to that server (the remote-access `Tunnel`). The API is addressed as `http://church-pc.invalid` (`config.WEB_APP_API_ORIGIN`), and only the installed tunnel answers it.
  - **This device's own machine**: the page is the browser server's only client, so its requests come from `localhost`, as the desktop app's windows do on the PC.
  - **One tab** holds the database (a Web Lock); another tab says so. Displays the app opens with `window.open` (the device's own screen, a second monitor) reach the opener's server, each on a `MessagePort` of its own.
  - **Its session**: the page signs in with a token its own database minted (tokens never sync), kept in memory only and handed to the displays it opens; the phone stores no login. It opens only this browser's copy; the church is reached with the device token alone.
  - **A removed device** loses the church on its next call to the sync service (a push, the check-in every 15 minutes, a start): the 401 reaches the page (`sync/cloud/tokenRefused.ts`), which confirms it with `/device`, starts again on the "removed" notice and deletes the church's database from this browser.
  - **A reload** waits for the OPFS pool's files the closing page still holds (up to 10 s), never opening a second, empty database; sqlite-wasm keeps the pool when that fails (`preserveOnInitFailure`).
  - **Deploying**: the Pages project serves the wasm (`application/wasm`) and the fixtures (each under Pages' 25 MiB limit). The sync service lists the app's origin in `ALLOWED_ORIGINS`. The bucket's CORS rule allows GET from it; with no exposed headers, the browser never sends `If-None-Match`, so no preflight is needed.
  - **Measured**: see the table below for the spike; a guest's first start (26,462 songs, 2 Bibles, desktop CPU) takes 17.6 s, and 1.4 s after that from OPFS.
- **Measured in the spike** (T-170; the spike's code became the browser server):
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
   - Public read without listing, on a local S3 server (section 3). Conditional PUT dropped: the service is the only writer. (T-171 brought it back to keep the central state in the bucket, with no database.)
2. **S3 transport + Hono sync service** (T-171):
   - `/sync/*` routes in `churchhub-backend`: register (guest), devices, changes, rotate the path.
   - **The central state** (one encrypted object per church in the bucket; no database): users, roles, permissions, devices, a version per row. **Every change is authorized against the user's permissions and versioned before it is published**; 403 and 409 answers are handled by the client.
   - The `s3` transport in `runSyncCycle` next to `drive`, with the bucket layout and compaction.
   - Drive stays as a backup option (D4).
3. **Owner identity** (T-172): Google sign-in as the owner (recorded in the central `churches` table), guest first and claim later, recovery on a new PC; the cloud identity in local backups.
4. **Sync every table** (T-173, D3): uuids on the remaining root tables, triggers, merge collections, and a version per row for the central check. As built: section 8, "Every table".
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
