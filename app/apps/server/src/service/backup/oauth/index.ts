import { buildDriveAuthUrl } from './buildDriveAuthUrl'
import { getDriveOAuthConfig, getDriveRedirectUri } from './config'
import { exchangeDriveCode } from './exchangeDriveCode'
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from './pkce'
import { consumeState, storeState } from './sessionStore'
import { createLogger } from '../../../utils/logger'
import { storeDriveAuth } from '../driveAuthStore'

const logger = createLogger('backup')

export type CreateDriveAuthUrlResult =
  | { authUrl: string }
  | { error: 'not_configured' }

/**
 * Starts a Drive connect flow: generates PKCE + state (kept server-side) and
 * returns the Google authorization URL for the app to open in a browser.
 */
export async function createDriveAuthUrl(): Promise<CreateDriveAuthUrlResult> {
  const { clientId, configured } = getDriveOAuthConfig()
  if (!configured) {
    return { error: 'not_configured' }
  }

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()
  storeState(state, codeVerifier)

  const authUrl = buildDriveAuthUrl({
    clientId,
    redirectUri: getDriveRedirectUri(),
    codeChallenge,
    state,
  })
  return { authUrl }
}

export type CompleteDriveAuthResult =
  | { success: true; email?: string }
  | { success: false; error: string }

/**
 * Completes the Drive connect flow at the loopback callback: validates the
 * state, exchanges the code for tokens (PKCE) and persists them.
 */
export async function completeDriveAuth(
  code: string,
  state: string,
): Promise<CompleteDriveAuthResult> {
  const codeVerifier = consumeState(state)
  if (!codeVerifier) {
    return { success: false, error: 'invalid_or_expired_state' }
  }

  const { clientId, clientSecret, configured } = getDriveOAuthConfig()
  if (!configured) {
    return { success: false, error: 'not_configured' }
  }

  try {
    const tokens = await exchangeDriveCode({
      code,
      clientId,
      clientSecret,
      redirectUri: getDriveRedirectUri(),
      codeVerifier,
    })
    await storeDriveAuth(tokens)
    logger.info(
      `Google Drive connected${tokens.email ? ` (${tokens.email})` : ''}`,
    )
    return { success: true, email: tokens.email }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'exchange_failed'
    logger.error(`Drive token exchange failed: ${message}`)
    return { success: false, error: message }
  }
}

export { getDriveOAuthConfig } from './config'
