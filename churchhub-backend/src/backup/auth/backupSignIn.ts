import type { Bindings } from '../../types'
import { isAllowedReturnUrl } from '../../sync/owner/isAllowedReturnUrl'
import { SyncError } from '../../sync/SyncError'
import { buildAuthUrl } from '../../utils/oauth'
import { generateCodeChallenge, generateCodeVerifier } from '../../utils/pkce'
import { createGrant } from './backupTokens'
import { readVerifiedGoogleAccount } from './readVerifiedGoogleAccount'
import {
  openBackupOAuthState,
  sealBackupOAuthState,
} from './sealBackupOAuthState'

/** A sign-in left unfinished this long is refused. */
const SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000
const SCOPE = 'openid email'
const NONCE = /^[A-Za-z0-9_-]{16,128}$/
/** base64url SHA-256: 43 characters. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/

function settings(env: Bindings, requestUrl: string) {
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
    throw new SyncError(503, 'not_configured', 'Google sign-in is not configured')
  }
  return {
    clientId: env.YOUTUBE_CLIENT_ID,
    redirectUri:
      env.BACKUP_REDIRECT_URI ||
      new URL('/backup/callback', requestUrl).toString(),
  }
}

/**
 * Starts the backup sign-in: the PC's return address, nonce and challenge
 * are sealed into the OAuth state with the PKCE verifier, and the browser
 * goes to Google's account chooser (scopes `openid email` only).
 */
export async function startBackupSignIn(
  env: Bindings,
  secret: string,
  requestUrl: string,
  query: { returnUrl?: string; nonce?: string; challenge?: string }
): Promise<string> {
  const { clientId, redirectUri } = settings(env, requestUrl)
  const { returnUrl, nonce, challenge } = query
  if (!returnUrl || !isAllowedReturnUrl(returnUrl, env.ALLOWED_ORIGINS)) {
    throw new SyncError(400, 'invalid_request', 'returnUrl is not allowed')
  }
  if (!nonce || !NONCE.test(nonce)) {
    throw new SyncError(400, 'invalid_request', 'nonce is required')
  }
  if (!challenge || !CHALLENGE.test(challenge)) {
    throw new SyncError(400, 'invalid_request', 'challenge is required')
  }
  const codeVerifier = generateCodeVerifier()
  const url = new URL(
    buildAuthUrl({
      clientId,
      redirectUri,
      codeChallenge: await generateCodeChallenge(codeVerifier),
      scope: SCOPE,
      prompt: 'select_account',
      offline: false,
      endpoint: env.GOOGLE_AUTH_URL,
    })
  )
  url.searchParams.set(
    'state',
    await sealBackupOAuthState(
      { codeVerifier, returnUrl, nonce, challenge, createdAt: Date.now() },
      secret
    )
  )
  return url.toString()
}

/**
 * Finishes the sign-in: reads the verified Google account and returns the
 * PC's callback URL with its nonce and a five-minute grant, bound to the
 * PC's challenge (so a grant copied from the browser's history is useless
 * without the verifier only the PC holds), or with the error.
 */
export async function finishBackupSignIn(
  env: Bindings,
  secret: string,
  requestUrl: string,
  query: { code?: string; state?: string; error?: string }
): Promise<string> {
  const { redirectUri } = settings(env, requestUrl)
  const state = query.state
    ? await openBackupOAuthState(query.state, secret)
    : null
  if (!state) {
    throw new SyncError(400, 'invalid_request', 'Invalid or expired sign-in')
  }
  const back = new URL(state.returnUrl)
  back.searchParams.set('nonce', state.nonce)
  const fail = (error: string) => {
    back.searchParams.set('error', error)
    return back.toString()
  }
  if (query.error) return fail('access_denied')
  if (!query.code) return fail('missing_code')
  if (Date.now() - state.createdAt > SIGN_IN_MAX_AGE_MS) return fail('expired')

  const account = await readVerifiedGoogleAccount(
    env,
    query.code,
    state.codeVerifier,
    redirectUri
  )
  if (!account) return fail('unverified_account')
  back.searchParams.set('grant', await createGrant(account, state.challenge, secret))
  return back.toString()
}
