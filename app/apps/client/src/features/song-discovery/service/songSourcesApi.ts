import { fetcher } from '~/utils/fetcher'
import type { SongSource } from '../providers/types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** Every song source the server knows, built-in first (GET /api/song-sources). */
export async function getSongSources(): Promise<SongSource[]> {
  const response = await fetcher<ApiResponse<SongSource[]>>('/api/song-sources')
  if (response.error) throw new Error(response.error)
  return response.data ?? []
}
