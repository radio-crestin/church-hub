import { readVerifiedGoogleAccount } from '../backup/auth/readVerifiedGoogleAccount'
import { openState, sealState } from '../backup/auth/sealState'
import { randomId } from '../sync/randomId'
import { constantTimeEqual } from '../utils/constantTimeEqual'
import type { Bindings } from '../types'
import { buildAuthUrl } from '../utils/oauth'
import { generateCodeChallenge, generateCodeVerifier } from '../utils/pkce'

const PURPOSE = 'church-hub-admin-oauth-v1'
const SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000

interface AdminOAuthState {
  codeVerifier: string
  /** Also in the flow cookie: the callback must come back to this browser. */
  nonce: string
  createdAt: number
}

const redirectUriFor = (env: Bindings, requestUrl: string) =>
  env.ADMIN_REDIRECT_URI || new URL('/admin/callback', requestUrl).toString()

/**
 * Starts an admin's Google sign-in (PKCE, `openid email`): the verifier and
 * a nonce are sealed into the OAuth state; the nonce also goes into a
 * cookie, so only the browser that started the sign-in can finish it.
 */
export async function startAdminSignIn(
  env: Bindings,
  secret: string,
  requestUrl: string
): Promise<{ url: string; nonce: string }> {
  const codeVerifier = generateCodeVerifier()
  const nonce = randomId(24)
  const url = new URL(
    buildAuthUrl({
      clientId: env.YOUTUBE_CLIENT_ID,
      redirectUri: redirectUriFor(env, requestUrl),
      codeChallenge: await generateCodeChallenge(codeVerifier),
      scope: 'openid email',
      prompt: 'select_account',
      offline: false,
      endpoint: env.GOOGLE_AUTH_URL,
    })
  )
  url.searchParams.set(
    'state',
    await sealState({ codeVerifier, nonce, createdAt: Date.now() }, secret, PURPOSE)
  )
  return { url: url.toString(), nonce }
}

/**
 * Finishes it: the state must open, be fresh and carry the flow cookie's
 * nonce; then the Google account, verified. Null on any failure (the
 * caller decides whether the account is an admin).
 */
export async function finishAdminSignIn(
  env: Bindings,
  secret: string,
  requestUrl: string,
  query: { code?: string; state?: string },
  flowNonce: string | undefined
): Promise<{ sub: string; email: string } | null> {
  const state = query.state
    ? await openState<AdminOAuthState>(query.state, secret, PURPOSE)
    : null
  if (
    !state ||
    !query.code ||
    !flowNonce ||
    !constantTimeEqual(state.nonce, flowNonce) ||
    Date.now() - state.createdAt > SIGN_IN_MAX_AGE_MS
  ) {
    return null
  }
  return readVerifiedGoogleAccount(
    env,
    query.code,
    state.codeVerifier,
    redirectUriFor(env, requestUrl)
  )
}
