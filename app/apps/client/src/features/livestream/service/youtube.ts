import { fetcher } from '../../../utils/fetcher'
import type {
  BroadcastInfo,
  StreamKey,
  YouTubeAuthStatus,
  YouTubeConfig,
} from '../types'

export async function getYouTubeAuthUrl(): Promise<string> {
  const response = await fetcher<{ data: { url: string } }>(
    '/api/livestream/youtube/auth-url',
  )
  return response.data.url
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
