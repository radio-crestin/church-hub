const DRIVE_CALLBACK_PATH = '/api/backup/google/callback'

/**
 * Base URL of the ChurchHub OAuth worker (Cloudflare). It holds the Google
 * OAuth client credentials server-side and serves BOTH the YouTube and the
 * Drive-backup flows, so the app ships with no embedded Google credentials.
 * Same env override as the livestream flow.
 */
export function getOAuthWorkerUrl(): string {
  return (
    process.env.YOUTUBE_OAUTH_SERVER ||
    'https://churchub-backend.radiocrestin.ro'
  )
}

/** The local origin the worker validates and calls back to. */
export function getLocalOrigin(): string {
  const port = process.env.PORT || '3000'
  return `http://localhost:${port}`
}

/**
 * The local endpoint the worker redirects back to with the tokens once Google
 * authorization completes (mode=redirect).
 */
export function getDriveReturnUrl(): string {
  return `${getLocalOrigin()}${DRIVE_CALLBACK_PATH}`
}
