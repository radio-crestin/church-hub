import { fetcher } from '~/utils/fetcher'
import type { BackgroundMedia } from './types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** Every uploaded background image and video, newest first. */
export async function listBackgroundMedia(): Promise<BackgroundMedia[]> {
  const res = await fetcher<ApiResponse<BackgroundMedia[]>>(
    '/api/media/backgrounds',
  )
  if (!res.data) {
    throw new Error(res.error || 'Failed to load background media')
  }
  return res.data
}
