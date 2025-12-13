import type { SongWithSlides } from '~/features/songs/types'
import { fetcher } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/**
 * Fetches all songs with slides for export
 * Optionally filters by category
 */
export async function fetchSongsForExport(
  categoryId: number | null,
): Promise<SongWithSlides[]> {
  const params = new URLSearchParams()
  if (categoryId !== null) {
    params.set('categoryId', String(categoryId))
  }

  const queryString = params.toString()
  const url = queryString
    ? `/api/songs/export?${queryString}`
    : '/api/songs/export'

  const response = await fetcher<ApiResponse<SongWithSlides[]>>(url)
  return response.data ?? []
}
