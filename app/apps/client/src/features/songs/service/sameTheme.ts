import { fetcher } from '~/utils/fetcher'
import type { SameThemeSong } from '../types'

/** Up to `limit` songs on the same theme as the song, best first. */
export async function getSameThemeSongs(
  songId: number,
  limit = 8,
): Promise<SameThemeSong[]> {
  const response = await fetcher<{ data?: SameThemeSong[] }>(
    `/api/songs/${songId}/same-theme?limit=${limit}`,
  )
  return response.data ?? []
}
