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
  // Optional static JSON array of RTCIceServer, e.g.
  // [{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
  TURN_SERVERS?: string
  // Cloudflare Realtime TURN key. When both are set, the worker mints
  // short-lived TURN credentials per request (the secret never leaves the
  // server). Create a key at Dashboard → Realtime → TURN.
  TURN_KEY_ID?: string
  TURN_API_TOKEN?: string
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
