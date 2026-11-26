import type { Bindings } from '../../types'
import { exchangeCodeForTokens } from '../../utils/oauth'
import type { BackupIdentity } from './backupTokens'

/**
 * Swaps Google's code for an access token and reads the account's id and
 * email; null unless Google says the email is verified. Errors are logged
 * without the code, the tokens or the email.
 */
export async function readVerifiedGoogleAccount(
  env: Bindings,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<BackupIdentity | null> {
  const tokens = await exchangeCodeForTokens({
    code,
    clientId: env.YOUTUBE_CLIENT_ID,
    clientSecret: env.YOUTUBE_CLIENT_SECRET,
    redirectUri,
    codeVerifier,
    endpoint: env.GOOGLE_TOKEN_URL,
  }).catch(() => {
    console.error('[backup] sign-in: token exchange failed')
    return null
  })
  if (!tokens) return null
  const response = await fetch(
    env.GOOGLE_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  if (!response.ok) {
    console.error(`[backup] sign-in: userinfo failed: ${response.status}`)
    return null
  }
  const user = (await response.json()) as {
    sub?: unknown
    email?: unknown
    email_verified?: unknown
  }
  if (
    typeof user.sub !== 'string' ||
    !user.sub ||
    typeof user.email !== 'string' ||
    user.email_verified !== true
  ) {
    return null
  }
  return { sub: user.sub, email: user.email.toLowerCase() }
}
