import { fetcher } from '~/utils/fetcher'
import type { SongThemeSuggestion } from '../types'

/** Up to `limit` other songs on the same theme as the song, closest first. */
export async function getSameThemeSongs(
  songId: number,
  limit = 8,
): Promise<SongThemeSuggestion[]> {
  const response = await fetcher<{ data?: SongThemeSuggestion[] }>(
    `/api/songs/${songId}/same-theme?limit=${limit}`,
  )
  return response.data ?? []
}
