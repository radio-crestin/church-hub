/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 authentication.
 * Note: Google requires client_secret even for Desktop apps with PKCE.
 * Per Google's docs, for Desktop apps the secret is embedded in client code
 * and "not treated as a secret" - this is acceptable and expected.
 */

/**
 * Generates a cryptographically random string for PKCE code_verifier.
 * Must be between 43-128 characters using unreserved characters (A-Z, a-z, 0-9, -, ., _, ~).
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Creates the code_challenge from the code_verifier using SHA-256.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Base64 URL encoding (RFC 4648 Section 5).
 * Removes padding and replaces + with - and / with _.
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface BuildAuthUrlParams {
  clientId: string
  redirectUri: string
  codeChallenge: string
  scope: string
  state?: string
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
  if (params.state) {
    url.searchParams.set('state', params.state)
  }
  return url.toString()
}

interface ExchangeCodeParams {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
  codeVerifier: string
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/**
 * Exchanges the authorization code for tokens using PKCE.
 * Google requires client_secret even for Desktop apps with PKCE.
 */
export async function exchangeCodeForTokens(
  params: ExchangeCodeParams,
): Promise<TokenResponse> {
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
    throw new Error(error.error_description || 'Token exchange failed')
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}
