/** starting: probe pending; enabled: verified; disabled: the probe failed; off: sync not configured. */
export type SyncReadiness = 'starting' | 'enabled' | 'disabled' | 'off'

export interface Bindings {
  YOUTUBE_CLIENT_ID: string
  YOUTUBE_CLIENT_SECRET: string
  YOUTUBE_REDIRECT_URI: string
  YOUTUBE_SCOPE: string
  // Google Drive backup flow — reuses the same Google OAuth client as YouTube
  // (YOUTUBE_CLIENT_ID/SECRET); only the scopes and callback URI differ.
  DRIVE_SCOPE: string
  DRIVE_REDIRECT_URI: string
  COOKIE_ENCRYPTION_KEY: string
  COOKIE_NAME: string
  COOKIE_MAX_AGE: number
  ALLOWED_ORIGINS: string
  SIGNALING_KV: KVNamespace
  /**
   * This service's public origin (e.g. https://backend.example.org), used for
   * links it hands out (the listener page, the owner sign-in
   * callback) instead of the request's Host. Default: the request URL.
   */
  PUBLIC_BASE_URL?: string
  // Cloud sync (T-171): the bucket (which also holds each church's encrypted
  // state: no database) and the secret. Unset = /sync answers 503.
  /** Hashes device tokens and, derived, encrypts the church states (openssl rand -hex 32). */
  SYNC_SECRET?: string
  /**
   * Node only: where the startup conditional-write probe stands (createSyncGuard).
   * Absent on the Worker, which has no probe, so it reads as ready.
   */
  SYNC_READINESS?: SyncReadiness
  /** Any S3-compatible endpoint, e.g. https://<account>.r2.cloudflarestorage.com */
  S3_ENDPOINT?: string
  S3_BUCKET?: string
  /** 'auto' for R2 (the default), the bucket's region elsewhere. */
  S3_REGION?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  /** Public, unlisted read URL of the bucket's root (readers GET from it). */
  S3_PUBLIC_URL?: string
  /** A private bucket for the encrypted church states (default: S3_BUCKET). */
  S3_STATE_BUCKET?: string
  /** Log segments after which the service writes a snapshot (default 40). */
  SYNC_COMPACT_AFTER?: string
  /** The bucket's address in presigned upload URLs, if not S3_ENDPOINT. */
  S3_PRESIGN_ENDPOINT?: string
  /** The most media a church keeps in the bucket, in bytes (default 2 GiB). */
  SYNC_MEDIA_MAX_BYTES?: string
  /** The largest media file a church may upload, in bytes (default 512 MiB). */
  SYNC_MEDIA_MAX_FILE_BYTES?: string
  /**
   * Owner sign-in (T-172) through the same Google client (YOUTUBE_CLIENT_*):
   * the callback URI registered on it (default: <this service>/sync/owner/callback).
   */
  OWNER_REDIRECT_URI?: string
  /** Google's endpoints, for a self-hosted test's stand-in (default: Google). */
  GOOGLE_AUTH_URL?: string
  GOOGLE_TOKEN_URL?: string
  GOOGLE_USERINFO_URL?: string
  /** Abuse guard for registering a church (optional binding). */
  SYNC_RATE_LIMITER?: RateLimit
  /**
   * The curated Church Hub Library (T-177): the curators' Google accounts
   * (emails or subs, comma-separated), and the abuse guard on submissions.
   */
  LIBRARY_CURATORS?: string
  /**
   * The build that publishes the libraries Church Hub manages (Resurse
   * Creștine…) writes them with this bearer token, as a curator would.
   */
  LIBRARY_PUBLISH_TOKEN?: string
  LIBRARY_RATE_LIMITER?: RateLimit
  /**
   * Church Hub Cloud backup (free, Google sign-in): a PRIVATE bucket of its
   * own and two secrets. Unset = /backup answers 503. See src/backup/.
   */
  /** Signs the backup tokens and OAuth state (openssl rand -hex 32). */
  BACKUP_SECRET?: string
  /** Derives account ids and account keys; never rotate (openssl rand -hex 32). */
  BACKUP_KEY_SECRET?: string
  BACKUP_S3_ENDPOINT?: string
  /** The bucket's address presigned URLs use, if not BACKUP_S3_ENDPOINT. */
  BACKUP_S3_PRESIGN_ENDPOINT?: string
  BACKUP_S3_BUCKET?: string
  BACKUP_S3_REGION?: string
  BACKUP_S3_ACCESS_KEY_ID?: string
  BACKUP_S3_SECRET_ACCESS_KEY?: string
  /** Free-tier overrides (bytes, counts); defaults in backup/backupSettings. */
  BACKUP_MAX_BYTES?: string
  BACKUP_QUOTA_BYTES?: string
  BACKUP_RETENTION_DAYS?: string
  BACKUP_UPLOADS_PER_DAY?: string
  /** The backup sign-in's callback (default: <this service>/backup/callback). */
  BACKUP_REDIRECT_URI?: string
  /**
   * The internal admin panel (src/admin), served only by the Node runtime on
   * its own listener (ADMIN_PORT, ADMIN_HOST), never on the Worker. Who may
   * sign in: Google subs and/or verified emails, comma-separated.
   */
  ADMIN_GOOGLE_SUBS?: string
  ADMIN_EMAILS?: string
  /** The admin sign-in's callback (default: <admin listener>/admin/callback). */
  ADMIN_REDIRECT_URI?: string
  /** Per-IP and per-account abuse guards (optional bindings). */
  BACKUP_RATE_LIMITER?: RateLimit
  BACKUP_ACCOUNT_RATE_LIMITER?: RateLimit
}

export interface OAuthState {
  codeVerifier: string
  origin: string
  returnMode: 'postMessage' | 'redirect'
  returnUrl?: string
  createdAt: number
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface TokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: number
  channelId?: string
  channelName?: string
  /** Connected Google account email (Drive flow). */
  email?: string
}
