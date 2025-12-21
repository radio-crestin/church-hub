import { fetcher } from '../../../utils/fetcher'
import type {
  BroadcastInfo,
  PastBroadcast,
  StreamKey,
  UpcomingBroadcast,
  YouTubeAuthStatus,
  YouTubeConfig,
} from '../types'

interface StoreTokensInput {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface StorePKCESessionInput {
  codeVerifier: string
  codeChallenge: string
}

/**
 * Store PKCE session on server for server-side token exchange.
 * Used when auth is initiated from Tauri and callback can't use postMessage.
 */
export async function storePKCESession(
  session: StorePKCESessionInput,
): Promise<string> {
  const response = await fetcher<{ data: { sessionId: string } }>(
    '/api/livestream/youtube/pkce-session',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    },
  )
  return response.data.sessionId
}

/**
 * Store OAuth tokens on the server after PKCE exchange on the client.
 */
export async function storeYouTubeTokens(
  tokens: StoreTokensInput,
): Promise<YouTubeAuthStatus> {
  const response = await fetcher<{ data: YouTubeAuthStatus }>(
    '/api/livestream/youtube/tokens',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens),
    },
  )
  return response.data
}

export async function getYouTubeAuthStatus(): Promise<YouTubeAuthStatus> {
  const response = await fetcher<{ data: YouTubeAuthStatus }>(
    '/api/livestream/youtube/status',
  )
  return response.data
}

export async function logoutYouTube(): Promise<void> {
  await fetcher('/api/livestream/youtube/logout', { method: 'DELETE' })
}

export async function getYouTubeConfig(): Promise<YouTubeConfig> {
  const response = await fetcher<{ data: YouTubeConfig }>(
    '/api/livestream/youtube/config',
  )
  return response.data
}

export async function updateYouTubeConfig(
  config: Partial<YouTubeConfig>,
): Promise<YouTubeConfig> {
  const response = await fetcher<{ data: YouTubeConfig }>(
    '/api/livestream/youtube/config',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    },
  )
  return response.data
}

export async function getStreamKeys(): Promise<StreamKey[]> {
  const response = await fetcher<{ data: StreamKey[] }>(
    '/api/livestream/youtube/streams',
  )
  return response.data
}

export async function createBroadcast(): Promise<BroadcastInfo> {
  const response = await fetcher<{ data: BroadcastInfo }>(
    '/api/livestream/youtube/broadcast',
    { method: 'POST' },
  )
  return response.data
}

export async function getActiveBroadcast(): Promise<BroadcastInfo | null> {
  const response = await fetcher<{ data: BroadcastInfo | null }>(
    '/api/livestream/youtube/broadcast/active',
  )
  return response.data
}

export async function endBroadcast(broadcastId: string): Promise<void> {
  await fetcher(`/api/livestream/youtube/broadcast/${broadcastId}/end`, {
    method: 'PUT',
  })
}

export async function getUpcomingBroadcasts(): Promise<UpcomingBroadcast[]> {
  const response = await fetcher<{ data: UpcomingBroadcast[] }>(
    '/api/livestream/youtube/broadcasts/upcoming',
  )
  return response.data
}

export async function getPastBroadcasts(): Promise<PastBroadcast[]> {
  const response = await fetcher<{ data: PastBroadcast[] }>(
    '/api/livestream/youtube/broadcasts/completed',
  )
  return response.data
}
