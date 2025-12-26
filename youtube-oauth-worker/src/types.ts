export interface Bindings {
  YOUTUBE_CLIENT_ID: string
  YOUTUBE_CLIENT_SECRET: string
  YOUTUBE_REDIRECT_URI: string
  YOUTUBE_SCOPE: string
  COOKIE_ENCRYPTION_KEY: string
  COOKIE_NAME: string
  COOKIE_MAX_AGE: number
  ALLOWED_ORIGINS: string
}

export interface OAuthState {
  codeVerifier: string
  origin: string
  returnMode: 'postMessage' | 'redirect'
  returnUrl?: string
  createdAt: number
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface TokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: number
  channelId?: string
  channelName?: string
}
