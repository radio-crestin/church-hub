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
  GITHUB_TOKEN: string
  SIGNALING_KV: KVNamespace
  // "Request a feature": screenshots, abuse limit and WhatsApp (WAHA) notice.
  /** Optional R2 bucket; without it screenshots go to the S3 bucket (S3_*). */
  FEATURE_REQUEST_SCREENSHOTS?: R2Bucket
  /** S3 bucket for screenshots (default S3_STATE_BUCKET, then S3_BUCKET). */
  FEATURE_REQUEST_S3_BUCKET?: string
  /**
   * This service's public origin (e.g. https://backend.example.org), used for
   * links it hands out (screenshot URLs, the listener page, the owner sign-in
   * callback) instead of the request's Host. Default: the request URL.
   */
  PUBLIC_BASE_URL?: string
  FEATURE_REQUEST_RATE_LIMITER: RateLimit
  WAHA_URL?: string
  WAHA_API_KEY?: string
  WAHA_SESSION?: string
  WAHA_CHAT_ID?: string
  // Cloudflare Access service token, only when WAHA sits behind Access.
  WAHA_ACCESS_CLIENT_ID?: string
  WAHA_ACCESS_CLIENT_SECRET?: string
  // Cloud sync (T-171): the bucket (which also holds each church's encrypted
  // state: no database) and the secret. Unset = /sync answers 503.
  /** Hashes device tokens and, derived, encrypts the church states (openssl rand -hex 32). */
  SYNC_SECRET?: string
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
