import { fetcher } from '~/utils/fetcher'
import type {
  Song,
  SongSearchResult,
  SongWithSlides,
  UpsertSongInput,
} from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getAllSongs(): Promise<Song[]> {
  const response = await fetcher<ApiResponse<Song[]>>('/api/songs')
  return response.data ?? []
}

export async function getSongById(id: number): Promise<SongWithSlides | null> {
  const response = await fetcher<ApiResponse<SongWithSlides>>(
    `/api/songs/${id}`,
  )
  return response.data ?? null
}

export async function upsertSong(
  input: UpsertSongInput,
): Promise<{ success: boolean; data?: SongWithSlides; error?: string }> {
  const response = await fetcher<ApiResponse<SongWithSlides>>('/api/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function deleteSong(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/songs/${id}`,
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}

export async function searchSongs(
  query: string,
  signal?: AbortSignal,
): Promise<SongSearchResult[]> {
  const response = await fetcher<ApiResponse<SongSearchResult[]>>(
    `/api/songs/search?q=${encodeURIComponent(query)}`,
    { signal },
  )
  return response.data ?? []
}
