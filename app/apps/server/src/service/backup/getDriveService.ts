import { OAuth2Client } from 'google-auth-library'
import { type drive_v3, google } from 'googleapis'

import {
  clearDriveAuth,
  getDriveAuth,
  updateDriveAccessToken,
} from './driveAuthStore'
import { getOAuthWorkerUrl } from './oauth/config'
import { createLogger } from '../../utils/logger'

const logger = createLogger('backup')

interface WorkerRefreshResponse {
  success?: boolean
  tokens?: { accessToken: string; refreshToken: string; expiresAt: number }
  error?: string
  requiresReauth?: boolean
}

/**
 * Refreshes the Drive access token through the ChurchHub OAuth worker — the
 * worker holds the Google client credentials, so the app never needs them.
 * Mirrors the livestream YouTube refresh flow.
 */
async function refreshViaWorker(
  refreshToken: string,
): Promise<
  | { ok: true; accessToken: string; expiresAt: number }
  | { ok: false; requiresReauth: boolean; error: string }
> {
  const response = await fetch(`${getOAuthWorkerUrl()}/auth/drive/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  const data = (await response.json()) as WorkerRefreshResponse
  if (response.ok && data.success && data.tokens) {
    return {
      ok: true,
      accessToken: data.tokens.accessToken,
      expiresAt: data.tokens.expiresAt,
    }
  }
  return {
    ok: false,
    requiresReauth: Boolean(data.requiresReauth),
    error: data.error || `refresh_failed_${response.status}`,
  }
}

/**
 * Builds an authenticated OAuth2 client for the Drive-backup connection,
 * refreshing the access token via the OAuth worker when it is close to expiry.
 * Returns null when not connected or the refresh token is no longer valid (in
 * which case the connection is cleared and a reconnect is required).
 */
async function getAuthenticatedDriveClient(): Promise<OAuth2Client | null> {
  const record = await getDriveAuth()
  if (!record) return null

  // No client id/secret here — token refresh goes through the worker, the
  // client only carries the access token for API calls.
  const client = new OAuth2Client()

  const needsRefresh = record.expiresAt.getTime() < Date.now() + 5 * 60 * 1000
  if (!needsRefresh) {
    client.setCredentials({ access_token: record.accessToken })
    return client
  }

  try {
    const refreshed = await refreshViaWorker(record.refreshToken)
    if (refreshed.ok) {
      await updateDriveAccessToken(
        record.id,
        refreshed.accessToken,
        new Date(refreshed.expiresAt),
      )
      client.setCredentials({ access_token: refreshed.accessToken })
      return client
    }

    if (refreshed.requiresReauth) {
      logger.warning(
        'Drive refresh token expired/revoked — clearing connection (reconnect required)',
      )
      await clearDriveAuth()
      return null
    }

    // Transient worker/Google failure: keep using the token if not yet expired.
    if (record.expiresAt.getTime() > Date.now()) {
      logger.warning(
        `Drive token refresh failed, using existing token: ${refreshed.error}`,
      )
      client.setCredentials({ access_token: record.accessToken })
      return client
    }
    logger.error(`Drive token refresh failed: ${refreshed.error}`)
    return null
  } catch (error) {
    // Network error reaching the worker (e.g. offline).
    const message = error instanceof Error ? error.message : String(error)
    if (record.expiresAt.getTime() > Date.now()) {
      logger.warning(
        `Drive token refresh unreachable, using existing token: ${message}`,
      )
      client.setCredentials({ access_token: record.accessToken })
      return client
    }
    logger.error(`Drive token refresh unreachable: ${message}`)
    return null
  }
}

/**
 * Returns an authenticated Google Drive v3 service, or null if the Drive backup
 * connection is not available (not connected, or expired).
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
