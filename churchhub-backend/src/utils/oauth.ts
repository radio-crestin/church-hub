import type { GoogleTokenResponse } from '../types'

interface BuildAuthUrlParams {
  clientId: string
  redirectUri: string
  codeChallenge: string
  scope: string
}

/**
 * Builds the Google OAuth authorization URL with PKCE parameters.
 */
export function buildAuthUrl(params: BuildAuthUrlParams): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', params.scope)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

interface ExchangeCodeParams {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
  codeVerifier: string
}

interface RefreshTokenParams {
  refreshToken: string
  clientId: string
  clientSecret: string
}

/**
 * Exchanges the authorization code for tokens using PKCE.
 */
export async function exchangeCodeForTokens(
  params: ExchangeCodeParams
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      code_verifier: params.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: params.redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      (error as { error_description?: string }).error_description ||
        'Token exchange failed'
    )
  }

  return response.json() as Promise<GoogleTokenResponse>
}

/**
 * Refreshes an access token using a refresh token.
 */
export async function refreshTokens(
  params: RefreshTokenParams
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      (error as { error_description?: string; error?: string }).error_description ||
        (error as { error?: string }).error ||
        'Token refresh failed'
    )
  }

  return response.json() as Promise<GoogleTokenResponse>
}
