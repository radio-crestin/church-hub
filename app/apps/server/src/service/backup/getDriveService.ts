import { type drive_v3, google } from 'googleapis'

import { getAuthenticatedClient } from '../livestream/youtube/client'

/**
 * Returns an authenticated Google Drive v3 service, or null if the user has not
 * connected their Google account.
 *
 * Backups reuse the single Google connection established for the livestream
 * feature (tokens live in the `youtube_auth` table). The OAuth consent requests
 * both the YouTube scope and `drive.appdata`, so the same access token works for
 * Drive. Token refresh is handled by `getAuthenticatedClient()`.
 *
 * Note: an account connected BEFORE the Drive scope was added will return a
 * client here, but Drive API calls will fail with an insufficient-scope 403.
 * Callers surface that as "reconnect required" via `isInsufficientScopeError`.
 */
export async function getDriveService(): Promise<drive_v3.Drive | null> {
  const client = await getAuthenticatedClient()

  if (!client) {
    return null
  }

  return google.drive({ version: 'v3', auth: client })
}

/**
 * Detects the Google API error raised when the current access token does not
 * carry the `drive.appdata` scope (i.e. the account was connected before Drive
 * backup existed and must reconnect to re-consent).
 */
export function isInsufficientScopeError(error: unknown): boolean {
  const err = error as {
    code?: number
    status?: number
    errors?: Array<{ reason?: string }>
    response?: { status?: number; data?: { error?: string } }
  }

  const status = err?.code ?? err?.status ?? err?.response?.status
  const reason = err?.errors?.[0]?.reason
  const oauthError = err?.response?.data?.error

  return (
    status === 403 &&
    (reason === 'insufficientPermissions' ||
      reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
      oauthError === 'insufficient_scope')
  )
}
