import { getServerPort } from '../../../utils/serverPort'

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
  return `http://localhost:${getServerPort()}`
}

/**
 * The local endpoint the worker redirects back to with the tokens once Google
 * authorization completes (mode=redirect). The worker keeps its query and
 * adds the tokens, so the flow's `state` comes back with them.
 */
export function getDriveReturnUrl(state: string): string {
  const url = new URL(DRIVE_CALLBACK_PATH, getLocalOrigin())
  url.searchParams.set('state', state)
  return url.toString()
}
