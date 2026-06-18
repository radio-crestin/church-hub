export interface Bindings {
  YOUTUBE_CLIENT_ID: string
  YOUTUBE_CLIENT_SECRET: string
  YOUTUBE_REDIRECT_URI: string
  YOUTUBE_SCOPE: string
  COOKIE_ENCRYPTION_KEY: string
  COOKIE_NAME: string
  COOKIE_MAX_AGE: number
  ALLOWED_ORIGINS: string
  GITHUB_TOKEN: string
  SIGNALING_KV: KVNamespace
  // Optional JSON array of RTCIceServer for the listener page, e.g.
  // [{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
  // Required for listeners on cellular / symmetric-NAT networks (STUN isn't enough).
  TURN_SERVERS?: string
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
