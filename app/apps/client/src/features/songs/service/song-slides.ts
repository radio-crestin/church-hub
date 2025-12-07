import { fetcher } from '~/utils/fetcher'
import type { SongSlide, UpsertSlideInput } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function upsertSongSlide(
  input: UpsertSlideInput,
): Promise<{ success: boolean; slide?: SongSlide; error?: string }> {
  const response = await fetcher<ApiResponse<SongSlide>>('/api/song-slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, slide: response.data }
}

export async function deleteSongSlide(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/song-slides/${id}`,
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}

export async function cloneSongSlide(
  id: number,
): Promise<{ success: boolean; slide?: SongSlide; error?: string }> {
  const response = await fetcher<ApiResponse<SongSlide>>(
    `/api/song-slides/${id}/clone`,
    {
      method: 'POST',
    },
  )

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, slide: response.data }
}

export async function reorderSongSlides(
  songId: number,
  slideIds: number[],
): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/songs/${songId}/slides/reorder`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideIds }),
    },
  )
  return response.data?.success ?? false
}
