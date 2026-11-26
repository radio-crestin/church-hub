import { fetcher } from '../../../utils/fetcher'
import type {
  BroadcastInfo,
  PastBroadcast,
  StreamKey,
  UpcomingBroadcast,
  VideoCategory,
  YouTubeAuthStatus,
  YouTubeConfig,
  YouTubePlaylist,
} from '../types'

interface StoreTokensInput {
  /** The sign-in's state, from {@link startYouTubeSignIn}. */
  state: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  channelId?: string
  channelName?: string
}

/**
 * Starts a YouTube sign-in: the state its tokens must come back with. The
 * server stores tokens only with a state it issued (single use, 10 minutes).
 */
export async function startYouTubeSignIn(): Promise<string> {
  const response = await fetcher<{ data?: { state: string }; error?: string }>(
    '/api/livestream/youtube/sign-in',
    { method: 'POST' },
  )
  if (!response.data) throw new Error(response.error ?? 'sign_in_failed')
  return response.data.state
}

/**
 * Stores the tokens a sign-in brought back, with that sign-in's state.
 */
export async function storeYouTubeTokens(
  tokens: StoreTokensInput,
): Promise<YouTubeAuthStatus> {
  const response = await fetcher<{ data?: YouTubeAuthStatus; error?: string }>(
    '/api/livestream/youtube/tokens',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens),
    },
  )
  if (!response.data) throw new Error(response.error ?? 'store_failed')
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

/** A changed setting; `null` clears an optional one. */
export type YouTubeConfigUpdate = {
  [K in keyof Omit<YouTubeConfig, 'id'>]?: YouTubeConfig[K] | null
}

export async function updateYouTubeConfig(
  config: YouTubeConfigUpdate,
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

export async function getYoutubePlaylists(): Promise<YouTubePlaylist[]> {
  const response = await fetcher<{ data: YouTubePlaylist[] }>(
    '/api/livestream/youtube/playlists',
  )
  return response.data
}

/** A past broadcast's settings, to fill the YouTube settings from. */
export async function getBroadcastTemplate(
  broadcastId: string,
): Promise<Partial<YouTubeConfig>> {
  const response = await fetcher<{ data: Partial<YouTubeConfig> }>(
    `/api/livestream/youtube/broadcasts/${encodeURIComponent(broadcastId)}/template`,
  )
  return response.data
}

export async function getVideoCategories(
  language: string,
): Promise<VideoCategory[]> {
  const response = await fetcher<{ data: VideoCategory[] }>(
    `/api/livestream/youtube/categories?hl=${encodeURIComponent(language)}`,
  )
  return response.data
}
