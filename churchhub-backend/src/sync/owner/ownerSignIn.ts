import type { Bindings } from '../../types'
import { buildAuthUrl, exchangeCodeForTokens } from '../../utils/oauth'
import { generateCodeChallenge, generateCodeVerifier } from '../../utils/pkce'
import { SyncError } from '../SyncError'
import { isAllowedReturnUrl } from './isAllowedReturnUrl'
import { createOwnerTicket } from './ownerTicket'
import { openOAuthState, sealOAuthState } from './sealOAuthState'

/** A sign-in left unfinished this long is refused. */
const SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000
const SCOPE = 'openid email'

function settings(env: Bindings, requestUrl: string) {
  if (!env.SYNC_SECRET || !env.YOUTUBE_CLIENT_ID) {
    throw new SyncError(503, 'not_configured', 'Google sign-in is not configured')
  }
  return {
    secret: env.SYNC_SECRET,
    clientId: env.YOUTUBE_CLIENT_ID,
    redirectUri:
      env.OWNER_REDIRECT_URI ||
      new URL('/sync/owner/callback', requestUrl).toString(),
  }
}

/**
 * Starts the owner's Google sign-in: the PC's return address and nonce are
 * sealed into the OAuth state with the PKCE verifier, and the browser goes
 * to Google's account chooser.
 */
export async function startOwnerSignIn(
  env: Bindings,
  requestUrl: string,
  returnUrl: string | undefined,
  nonce: string | undefined
): Promise<string> {
  const { secret, clientId, redirectUri } = settings(env, requestUrl)
  if (!returnUrl || !isAllowedReturnUrl(returnUrl, env.ALLOWED_ORIGINS)) {
    throw new SyncError(400, 'invalid_request', 'returnUrl is not allowed')
  }
  if (!nonce || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new SyncError(400, 'invalid_request', 'nonce is required')
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
    await sealOAuthState(
      { codeVerifier, returnUrl, nonce, createdAt: Date.now() },
      secret
    )
  )
  return url.toString()
}

/**
 * Finishes the sign-in: exchanges Google's code, reads the account's
 * verified id and email, and returns the PC's callback URL carrying a
 * signed owner ticket and the PC's nonce (or the error).
 */
export async function finishOwnerSignIn(
  env: Bindings,
  requestUrl: string,
  query: { code?: string; state?: string; error?: string }
): Promise<string> {
  const { secret, clientId, redirectUri } = settings(env, requestUrl)
  const state = query.state ? await openOAuthState(query.state, secret) : null
  if (!state) {
    throw new SyncError(400, 'invalid_request', 'Invalid or expired sign-in')
  }
  const back = new URL(state.returnUrl)
  back.searchParams.set('nonce', state.nonce)
  const fail = (error: string) => {
    back.searchParams.set('error', error)
    return back.toString()
  }
  if (query.error) return fail(query.error)
  if (!query.code) return fail('missing_code')
  if (Date.now() - state.createdAt > SIGN_IN_MAX_AGE_MS) return fail('expired')

  const tokens = await exchangeCodeForTokens({
    code: query.code,
    clientId,
    clientSecret: env.YOUTUBE_CLIENT_SECRET,
    redirectUri,
    codeVerifier: state.codeVerifier,
    endpoint: env.GOOGLE_TOKEN_URL,
  }).catch((error: unknown) => {
    console.error('[sync] owner sign-in: token exchange failed:', error)
    return null
  })
  if (!tokens) return fail('token_exchange_failed')
  const response = await fetch(
    env.GOOGLE_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const user = response.ok
    ? ((await response.json()) as {
        sub?: string
        email?: string
        email_verified?: boolean
      })
    : null
  if (!user?.sub || !user.email || user.email_verified !== true) {
    return fail('unverified_account')
  }

  const { ticket, expiresAt } = await createOwnerTicket(
    { googleSub: user.sub, email: user.email.toLowerCase() },
    secret
  )
  back.searchParams.set('ticket', ticket)
  back.searchParams.set('expiresAt', String(expiresAt))
  return back.toString()
}
