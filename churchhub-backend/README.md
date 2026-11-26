# Google OAuth Worker

A Cloudflare Worker that handles Google OAuth authentication for the ChurchHub
app — both the **YouTube** (livestream) and **Google Drive** (database backup)
flows. Both flows share the SAME Google OAuth client
(`YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`); they differ only in scopes and
callback URI, so the app ships with **no embedded Google credentials**.

## Overview

This worker provides a stateless OAuth flow using:
- **PKCE** (Proof Key for Code Exchange) for enhanced security
- **Encrypted cookies** for state management (no database required)
- **AES-256-GCM** encryption for cookie security

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/youtube` | GET | Initiates the YouTube OAuth flow, redirects to Google. `origin` must be in `ALLOWED_ORIGINS`; `mode=redirect` takes a `returnUrl` on that same origin |
| `/auth/youtube/callback` | GET | Handles Google callback, returns tokens (+ channel info) |
| `/auth/youtube/refresh` | POST | Refreshes a YouTube access token |
| `/auth/drive` | GET | Initiates the Drive backup OAuth flow (`drive.appdata` + identity scopes); same `origin`/`returnUrl` rules |
| `/auth/drive/callback` | GET | Handles Google callback, returns tokens (+ account email) |
| `/auth/drive/refresh` | POST | Refreshes a Drive access token |
| `/health` | GET | Health check endpoint |
| `/feature-requests` | POST | "Request a feature": stores the screenshot in R2, opens a public GitHub issue that embeds it (no email), notifies WhatsApp via WAHA (with email). Max 3/min and 50 per rolling 24h per IP (hashed IP counter in `SIGNALING_KV`) |
| `/feature-requests/screenshots/:id` | GET | Serves a feature-request screenshot from R2 (embedded in the issue; random id, cached a year) |
| `/sync/*` | GET, POST, PUT, DELETE | Cloud sync service (see below); documented at `/sync/openapi.json`, rendered at `/sync/docs` |
| `/backup/*` | GET, POST, DELETE | Church Hub Cloud backup, free with Google sign-in (see below); documented at `/backup/openapi.json`, rendered at `/backup/docs` |

> Drive setup: enable the **Google Drive API** in the same Google Cloud project
> and register `https://churchub-backend.radiocrestin.ro/auth/drive/callback`
> as an additional authorized redirect URI on the SAME OAuth client.

## Cloud sync (`/sync/*`)

The one writer of every church's synced library
(`docs/design/cloud-sync-and-shared-library.md` §3-6). A church server
registers, owned by a Google account or as a guest (`POST /sync/churches`), mirrors its roles and users
(`PUT …/access`), mints device tokens for its users (`POST …/devices`), and
every device writes through `POST …/changes`: authenticated by its token,
authorized against its user's permissions, version-checked, then published to
an S3-compatible bucket as one segment under `churches/<churchId>-<pathSecret>/`.
Reads never call the service: clients GET that public, unlisted path directly.

**No database.** Each church's state (its devices, as token hashes only; its
roles, users and permissions; every row's version; the segments after the
snapshot) is one object, `sync-state/<churchId>.bin`, gzipped and sealed
with AES-256-GCM under a key derived from `SYNC_SECRET`. It can sit in the
public bucket (without the secret it is unreadable, and tampering is
detected), or in a private bucket of its own (`S3_STATE_BUCKET`), which is
better still. Every change is a compare-and-swap on that object: the service
writes it with `If-Match` on the ETag it read, and when another write got
there first (412) it reads again and retries.

So the bucket must support **conditional writes** (`If-Match` and
`If-None-Match: *` on `PutObject`): Cloudflare R2, AWS S3 and MinIO do. A
store without them can't keep concurrent writers apart. The service also
lists its own prefixes (with its keys) to delete what a snapshot replaced:
after each compaction, the snapshot before last and every segment it covers
go, so no lifecycle rule is needed and none can delete a segment `head.json`
still lists. Missing settings make the routes answer `503 not_configured`,
so the rest of the Worker deploys without them.

**Settings** (Worker vars or secrets, or environment when self-hosted):

| Name | |
|---|---|
| `SYNC_SECRET` | Hashes the device tokens and, derived, encrypts the church states (secret; `openssl rand -hex 32`). Losing it locks every church out. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` | An S3-compatible bucket with conditional writes, path-style (`S3_REGION` defaults to `auto`, R2's) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Read, write and list keys, held only by the service (secrets) |
| `S3_PUBLIC_URL` | The bucket's public read URL (anonymous `GetObject` on `churches/*`, no listing) |
| `S3_STATE_BUCKET` | Optional: a private bucket (same endpoint and keys) for `sync-state/` |
| `SYNC_COMPACT_AFTER` | Segments between snapshots (default 40) |
| `SYNC_RATE_LIMITER` | Rate-limit binding on registration (bound in `wrangler.toml`: 3/min per IP; optional when self-hosted) |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | The Google OAuth client the owner sign-in uses (the one YouTube and Drive share) |
| `OWNER_REDIRECT_URI` | Optional: the sign-in's callback, registered on that client (default `<this service>/sync/owner/callback`) |
| `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_USERINFO_URL` | Optional: Google's endpoints, for a test's stand-in |

**The owner** (§6). `GET /sync/owner/sign-in?returnUrl&nonce` sends the
browser to Google (scopes `openid email`); the callback reads the account's
verified id and email and redirects to `returnUrl` (the church PC's loopback
page, or an `ALLOWED_ORIGINS` one) with the PC's nonce and an owner ticket:
`cho_<payload>.<HMAC>`, signed with `SYNC_SECRET`, valid one hour. The PKCE
verifier, return URL and nonce travel sealed in the OAuth `state` (AES-GCM),
so no cookie is needed. The owner is kept in the church's state; empty
marker objects `sync-owners/<hmac(email)>/<churchId>` list an account's
churches. With a ticket (`Authorization: Bearer cho_…`) the owner lists
their churches, recovers one on a new PC (`…/recover`: a fresh server
token), revokes every device and rotates the path (`…/reset`), and offers
the church to another account (`…/transfer`), which accepts it
(`…/accept`). A guest church is claimed by its server (`POST …/owner`).

**One PC per church server.** The church PC names its installation on
every call (`X-Church-Hub-Installation`, `-Name`). A local backup restored
on another PC carries the server token; the service answers that other
installation `409 server_in_use` (who holds it, last seen when) until the
user picks it (`POST …/takeover`).

**On Cloudflare**, once:

```bash
npx wrangler r2 bucket create church-hub-sync # public access through a custom domain; no listing
```

Then add the secrets above to `.prod.vars` (an R2 API token with read and
write on the bucket). Plan on the Workers paid plan: compacting a large
library (building, gzipping and uploading a snapshot of several MB) will
likely take more than the free plan's 10 ms of CPU per request.

**Self-hosted** (Bun or Node, and your own bucket: MinIO, AWS S3, R2…):

```bash
npm ci
SYNC_SECRET=… S3_ENDPOINT=… S3_BUCKET=… S3_ACCESS_KEY_ID=… \
  S3_SECRET_ACCESS_KEY=… S3_PUBLIC_URL=… PORT=8787 \
  bun src/selfhost/server.ts            # or: npx tsx src/selfhost/server.ts (Node)
```

The app points at it with `CHURCH_HUB_SYNC_URL` (or `serviceUrl` in
`POST /api/sync/cloud`). The e2e spec `app/apps/client/e2e/cloud-sync.spec.ts`
runs it this way against an S3 stand-in, and `cloud-owner.spec.ts` with a
Google stand-in too.

For the owner sign-in in production, register
`https://churchub-backend.radiocrestin.ro/sync/owner/callback` as an
authorized redirect URI on the Google OAuth client.

## Cloud backup (`/backup/*`)

Free backups of a church's database for anyone who signs in with Google.
The API, its limits and its errors are in `/backup/openapi.json` (code:
`src/backup/`, routes in `src/routes/backup.ts`).

- **Sign-in**: the PC opens `/backup/sign-in` with its loopback callback, a
  nonce and the SHA-256 of a verifier it keeps; Google (PKCE, `openid email`,
  verified email only) answers `/backup/callback`, which hands the PC a
  five-minute grant. The PC swaps grant + verifier for a one-hour access
  token and a 180-day refresh token (`chba_`/`chbr_`, HMAC-signed with
  `BACKUP_SECRET`, bound to the Google `sub`). Signing out or deleting the
  account refuses every token issued before.
- **Storage**: a private bucket of its own. Each account's folder is
  `accounts/<HMAC(sub)>/`: a small `account.json` (backup ids, sizes, dates,
  app versions; no email, no Google id) and the encrypted backups. Uploads
  and downloads go straight to the bucket through presigned URLs valid 15
  minutes, handed out after the session and free-tier checks.
- **Encryption**: the app encrypts each backup (AES-256-GCM, a fresh key per
  backup) and wraps that key with the account key from `GET /backup/key`,
  derived from `BACKUP_KEY_SECRET` and the `sub`: the bucket alone can't read
  a backup, and the same account restores after a reinstall by signing in.
- **Free tier** (defaults, each overridable): 512 MiB a backup
  (`BACKUP_MAX_BYTES`), 2 GiB an account (`BACKUP_QUOTA_BYTES`), at most 12
  kept (`BACKUP_MAX_COUNT`: the newest 3, one a day for 7 days, one a week
  for 5 weeks), 24 uploads a day (`BACKUP_UPLOADS_PER_DAY`), 2 in flight.
  Per IP and per account rate limits: the `BACKUP_RATE_LIMITER` and
  `BACKUP_ACCOUNT_RATE_LIMITER` bindings on Cloudflare, an in-memory window
  of the same size on Node or Bun.

**Settings** (secrets; unset = `/backup` answers `503 not_configured`):

| Name | |
|---|---|
| `BACKUP_SECRET` | Signs tokens and the OAuth state (`openssl rand -hex 32`). Rotating it signs everyone out. |
| `BACKUP_KEY_SECRET` | Derives account ids and account keys (`openssl rand -hex 32`). Never rotate it: losing it loses every backup. |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION` | The private bucket, path-style, with multipart uploads and conditional writes (`BACKUP_S3_REGION` defaults to `auto`) |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | Read, write, list and multipart on that bucket only |
| `BACKUP_S3_PRESIGN_ENDPOINT` | Optional: the bucket's public address for presigned URLs, when the service reaches it on another (e.g. inside a cluster) |
| `BACKUP_REDIRECT_URI` | The sign-in's callback, registered on the Google client (in `wrangler.toml`; default `<this service>/backup/callback`) |

**The bucket**: no public access and no listing for anyone but the service.
Recommended lifecycle rule: abort incomplete multipart uploads after 1 day
(the service aborts the ones it knows of; this catches the rest).

## Google Cloud Console Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**:
   - Navigate to **APIs & Services** > **Library**
   - Search for "YouTube Data API v3"
   - Click **Enable**

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (or Internal if using Google Workspace)
3. Fill in the required fields:
   - **App name**: ChurchHub
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**
5. Add scopes:
   - Click **Add or Remove Scopes**
   - Search for and select: `https://www.googleapis.com/auth/youtube.force-ssl`
   - Click **Update**
6. Add test users (if in testing mode):
   - Add the Google accounts that will test the integration
7. Complete the wizard

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Desktop app** as the application type
   - Note: Desktop app type is recommended because it requires PKCE and allows the client secret to be embedded (per Google's guidelines)
4. Name it (e.g., "ChurchHub Desktop")
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### 4. Add Redirect URIs

1. In the OAuth client settings, add these **Authorized redirect URIs**:

   **Development:**
   ```
   http://localhost:8787/auth/youtube/callback
   ```

   **Production:**
   ```
   https://churchub-backend.radiocrestin.ro/auth/youtube/callback
   ```

2. Click **Save**

## Local Development

### 1. Install Dependencies

```bash
cd youtube-oauth-worker
npm install
```

### 2. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
YOUTUBE_CLIENT_ID=your-client-id-from-google
YOUTUBE_CLIENT_SECRET=your-client-secret-from-google
YOUTUBE_REDIRECT_URI=http://localhost:8787/auth/youtube/callback
COOKIE_ENCRYPTION_KEY=your-32-byte-hex-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8086
```

Generate an encryption key:

```bash
openssl rand -hex 32
```

### 3. Run Development Server

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

### 4. Test the Flow

1. Start your ChurchHub app (should be running on `http://localhost:3000`)
2. Navigate to the livestream settings
3. Click "Connect YouTube"
4. Complete the OAuth flow in the popup

## Production Deployment

### 1. Deploy to Cloudflare

```bash
npm run deploy
```

### 2. Configure Production Environment

Create `.prod.vars` with your production values:

```env
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=https://churchub-backend.radiocrestin.ro/auth/youtube/callback
COOKIE_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
ALLOWED_ORIGINS=https://churchub-backend.radiocrestin.ro,http://localhost:3000
GITHUB_TOKEN=<fine-grained PAT, radio-crestin/church-hub, Issues: read and write>
# Optional WhatsApp notice for feature requests (see .dev.vars.example)
WAHA_URL=<public WAHA base URL>
WAHA_API_KEY=<WAHA X-Api-Key>
WAHA_CHAT_ID=<chat id, e.g. 407...@c.us or ...@g.us>
```

Feature-request screenshots live in an R2 bucket, created once before the
first deploy:

```bash
npx wrangler r2 bucket create church-hub-feature-requests
```

Then deploy. `deploy.sh` checks `.prod.vars` (no empty or placeholder
values, required keys present) and uploads every value as a Worker secret
with the new version (`wrangler deploy --secrets-file`), so none of them is
stored as a plain-text variable:

```bash
npm run deploy:prod
```

### 3. Configure Custom Domain (Optional)

The `wrangler.toml` is configured to use `churchub-backend.radiocrestin.ro`.

To set up the custom domain:
1. Go to Cloudflare Dashboard > Workers & Pages
2. Select the worker
3. Go to **Settings** > **Triggers** > **Custom Domains**
4. Add `churchub-backend.radiocrestin.ro`
5. Cloudflare will automatically configure DNS and SSL

### 4. Update Client Configuration

In your ChurchHub app, update the environment variable:

```env
VITE_YOUTUBE_OAUTH_SERVER=https://churchub-backend.radiocrestin.ro
```

## Security Considerations

| Feature | Implementation |
|---------|---------------|
| PKCE Code Verifier | Encrypted with AES-256-GCM in HTTP-only cookie |
| State Management | Encrypted cookie with origin validation |
| XSS Protection | Strict postMessage origin validation |
| Token Security | Server-side exchange, client secret not exposed to browser |
| Replay Prevention | One-time cookie consumption, 10-minute TTL |
| Transport Security | HTTPS enforced, HSTS headers |

## Troubleshooting

### "Invalid or missing origin" error

- Ensure the app's origin is in the `ALLOWED_ORIGINS` list
- Check that the origin is being sent correctly (via header or query param)

### "State expired" error

- The OAuth flow took longer than 10 minutes
- Try again with a faster network connection

### "Token exchange failed" error

- Verify the Google OAuth credentials are correct
- Check that the redirect URI matches exactly in Google Console
- Ensure the YouTube Data API is enabled

### Cookies not being set

- Ensure `SameSite=Lax` is compatible with your setup
- Check browser dev tools for cookie warnings
- Verify HTTPS is being used in production

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   ChurchHub     │────>│  YouTube OAuth       │────>│   Google OAuth  │
│   Client App    │     │  Worker (CF)         │     │   Server        │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │                        │                           │
        │  1. Open popup         │                           │
        │  ─────────────>        │                           │
        │                        │  2. Generate PKCE         │
        │                        │  3. Set encrypted cookie  │
        │                        │  4. Redirect to Google    │
        │                        │  ─────────────────────>   │
        │                        │                           │
        │                        │  5. User authorizes       │
        │                        │  <─────────────────────   │
        │                        │                           │
        │                        │  6. Exchange code         │
        │                        │  ─────────────────────>   │
        │                        │                           │
        │                        │  7. Receive tokens        │
        │                        │  <─────────────────────   │
        │                        │                           │
        │  8. postMessage        │                           │
        │  <─────────────        │                           │
        │                        │                           │
        │  9. Store tokens       │                           │
        │  (in main app server)  │                           │
        │                        │                           │
```

## License

MIT
