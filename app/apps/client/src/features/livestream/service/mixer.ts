import { fetcher } from '../../../utils/fetcher'
import type { MixerChannel, MixerConfig } from '../types'

export async function getMixerConfig(): Promise<MixerConfig> {
  const response = await fetcher<{ data: MixerConfig }>(
    '/api/livestream/mixer/config',
  )
  return response.data
}

export async function updateMixerConfig(
  data: Partial<MixerConfig>,
): Promise<MixerConfig> {
  const response = await fetcher<{ data: MixerConfig }>(
    '/api/livestream/mixer/config',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  )
  return response.data
}

export async function getMixerChannels(): Promise<MixerChannel[]> {
  const response = await fetcher<{ data: MixerChannel[] }>(
    '/api/livestream/mixer/channels',
  )
  return response.data
}

export async function updateMixerChannels(
  channels: { channelNumber: number; label: string }[],
): Promise<MixerChannel[]> {
  const response = await fetcher<{ data: MixerChannel[] }>(
    '/api/livestream/mixer/channels',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels }),
    },
  )
  return response.data
}

export async function testMixerConnection(): Promise<{
  success: boolean
  error?: string
}> {
  const response = await fetcher<{
    data: { success: boolean; error?: string }
  }>('/api/livestream/mixer/test', {
    method: 'POST',
  })
  return response.data
}
