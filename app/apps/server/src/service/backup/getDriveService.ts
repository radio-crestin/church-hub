import { OAuth2Client } from 'google-auth-library'
import { type drive_v3, google } from 'googleapis'

import {
  clearDriveAuth,
  getDriveAuth,
  updateDriveAccessToken,
} from './driveAuthStore'
import { getDriveOAuthConfig } from './oauth/config'
import { createLogger } from '../../utils/logger'

const logger = createLogger('backup')

/**
 * Builds an authenticated OAuth2 client for the independent Drive connection,
 * refreshing the access token when it is close to expiry. Because the app owns
 * the OAuth client credentials locally, refresh happens directly against Google
 * (no worker needed). Returns null when not configured, not connected, or the
 * refresh token is no longer valid (in which case the connection is cleared).
 */
async function getAuthenticatedDriveClient(): Promise<OAuth2Client | null> {
  const { clientId, clientSecret, configured } = getDriveOAuthConfig()
  if (!configured) return null

  const record = await getDriveAuth()
  if (!record) return null

  const client = new OAuth2Client(clientId, clientSecret)
  client.setCredentials({
    access_token: record.accessToken,
    refresh_token: record.refreshToken,
    expiry_date: record.expiresAt.getTime(),
  })

  const needsRefresh = record.expiresAt.getTime() < Date.now() + 5 * 60 * 1000
  if (!needsRefresh) {
    return client
  }

  try {
    const { credentials } = await client.refreshAccessToken()
    const newExpiry = credentials.expiry_date ?? Date.now() + 3600 * 1000
    await updateDriveAccessToken(
      record.id,
      credentials.access_token!,
      new Date(newExpiry),
    )
    client.setCredentials(credentials)
    return client
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('invalid_grant')) {
      logger.warning(
        'Drive refresh token expired/revoked — clearing connection (reconnect required)',
      )
      await clearDriveAuth()
      return null
    }
    // Transient failure (e.g. offline): keep using the token if not yet expired.
    if (record.expiresAt.getTime() > Date.now()) {
      logger.warning(
        `Drive token refresh failed, using existing token: ${message}`,
      )
      return client
    }
    logger.error(`Drive token refresh failed: ${message}`)
    return null
  }
}

/**
 * Returns an authenticated Google Drive v3 service, or null if the Drive backup
 * connection is not available (unconfigured, not connected, or expired).
 */
export async function getDriveService(): Promise<drive_v3.Drive | null> {
  const client = await getAuthenticatedDriveClient()
  if (!client) return null
  return google.drive({ version: 'v3', auth: client })
}

/**
 * Detects the Google API error raised when the access token does not carry the
 * `drive.appdata` scope (defensive — the connect flow always requests it).
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
