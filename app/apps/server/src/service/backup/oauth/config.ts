const DRIVE_REDIRECT_PATH = '/api/backup/google/callback'

/**
 * OAuth scopes for the independent Drive-backup connection:
 * - `drive.appdata`: private, hidden per-app folder for the database backups.
 * - `openid` + `userinfo.email`: to show which Google account is connected.
 */
export const DRIVE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.appdata',
]

/**
 * Reads the ChurchHub "Desktop app" OAuth client credentials from the
 * environment. These belong to the app's OWN Google Cloud project (independent
 * of the livestream YouTube client). `configured` is false when unset, so the
 * feature degrades gracefully instead of erroring.
 */
export function getDriveOAuthConfig(): {
  clientId: string
  clientSecret: string
  configured: boolean
} {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || ''
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  }
}

/**
 * The local-loopback redirect URI Google returns to after consent. Matches the
 * server port so it works in dev (3000) and in worktrees. "Desktop app" OAuth
 * clients accept localhost redirects with any port/path.
 */
export function getDriveRedirectUri(): string {
  const port = process.env.PORT || '3000'
  return `http://localhost:${port}${DRIVE_REDIRECT_PATH}`
}
