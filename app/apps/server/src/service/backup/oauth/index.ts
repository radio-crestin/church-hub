import { getDriveReturnUrl, getLocalOrigin } from './config'
import { consumeDriveAuthState, issueDriveAuthState } from './driveAuthStates'
import { createLogger } from '../../../utils/logger'
import { getBackendBaseUrl } from '../../backend'
import { storeDriveAuth } from '../driveAuthStore'

const logger = createLogger('backup')

export type CreateDriveAuthUrlResult = { authUrl: string }

/**
 * Starts a Drive connect flow through the ChurchHub OAuth worker (the same
 * Cloudflare worker the YouTube flow uses — it holds the Google client
 * credentials server-side). The worker runs PKCE against Google and redirects
 * back to this server's /api/backup/google/callback with the tokens and the
 * flow's state, which the callback requires.
 */
export function createDriveAuthUrl(): CreateDriveAuthUrlResult {
  const url = new URL('/auth/drive', getBackendBaseUrl())
  url.searchParams.set('origin', getLocalOrigin())
  url.searchParams.set('mode', 'redirect')
  url.searchParams.set('returnUrl', getDriveReturnUrl(issueDriveAuthState()))
  return { authUrl: url.toString() }
}

export interface WorkerDriveTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email?: string
}

export type CompleteDriveAuthResult =
  | { success: true; email?: string }
  | { success: false; error: string }

/**
 * Completes the Drive connect flow: persists the tokens the worker handed back
 * on the redirect, only for a flow this server started (its `state`), so no
 * other page can connect the backup to an account of its choosing. A missing
 * refresh token means we couldn't stay connected across restarts, so it is
 * rejected (the worker requests offline access).
 */
export async function completeDriveAuth(
  state: string | null,
  tokens: WorkerDriveTokens,
): Promise<CompleteDriveAuthResult> {
  if (!consumeDriveAuthState(state)) {
    logger.warning('Drive connect refused: unknown or expired state')
    return { success: false, error: 'unknown_connect_flow' }
  }
  if (!tokens.accessToken || !tokens.refreshToken) {
    return { success: false, error: 'missing_tokens' }
  }
  if (!Number.isFinite(tokens.expiresAt) || tokens.expiresAt <= Date.now()) {
    return { success: false, error: 'invalid_expiry' }
  }

  try {
    await storeDriveAuth({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      email: tokens.email,
    })
    logger.info(
      `Google Drive connected${tokens.email ? ` (${tokens.email})` : ''}`,
    )
    return { success: true, email: tokens.email }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'store_failed'
    logger.error(`Failed to store Drive tokens: ${message}`)
    return { success: false, error: message }
  }
}
