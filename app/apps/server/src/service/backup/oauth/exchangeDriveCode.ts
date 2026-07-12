interface ExchangeParams {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
  codeVerifier: string
}

export interface DriveTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email?: string
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

/**
 * Exchanges an authorization code for Drive tokens (PKCE), then looks up the
 * connected account's email for display.
 */
export async function exchangeDriveCode(
  params: ExchangeParams,
): Promise<DriveTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    const error = (await response.json().catch(() => ({}))) as {
      error_description?: string
      error?: string
    }
    throw new Error(
      error.error_description || error.error || 'Token exchange failed',
    )
  }

  const data = (await response.json()) as GoogleTokenResponse
  const email = await fetchAccountEmail(data.access_token)

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + data.expires_in * 1000,
    email,
  }
}

async function fetchAccountEmail(
  accessToken: string,
): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return undefined
    const data = (await res.json()) as { email?: string }
    return data.email
  } catch {
    return undefined
  }
}
