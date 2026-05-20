import { fetcher } from '~/utils/fetcher'
import type { SongTag, UpsertTagInput } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getAllTags(): Promise<SongTag[]> {
  const response = await fetcher<ApiResponse<SongTag[]>>('/api/song-tags')
  return response.data ?? []
}

export async function upsertTag(
  input: UpsertTagInput,
): Promise<{ success: boolean; tag?: SongTag; error?: string }> {
  const response = await fetcher<ApiResponse<SongTag>>('/api/song-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, tag: response.data }
}

export async function deleteTag(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/song-tags/${id}`,
    { method: 'DELETE' },
  )
  return response.data?.success ?? false
}

export async function reorderTags(
  tagIds: number[],
): Promise<{ success: boolean; error?: string }> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    '/api/song-tags/reorder',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds }),
    },
  )

  if (response.error) {
    return { success: false, error: response.error }
  }
  return { success: true }
}
