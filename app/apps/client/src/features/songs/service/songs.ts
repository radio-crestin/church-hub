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

interface DuplicateErrorResponse {
  error: 'DUPLICATE_TITLE'
  existingSongId: number
  existingSongTitle: string
}

export interface UpsertSongResult {
  success: boolean
  data?: SongWithSlides
  error?: string
  isDuplicate?: boolean
  existingSongId?: number
  existingSongTitle?: string
}

export async function upsertSong(
  input: UpsertSongInput,
): Promise<UpsertSongResult> {
  const response = await fetcher<
    ApiResponse<SongWithSlides> | DuplicateErrorResponse
  >('/api/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  // Check for duplicate title error
  if ('existingSongId' in response && response.error === 'DUPLICATE_TITLE') {
    return {
      success: false,
      error: 'DUPLICATE_TITLE',
      isDuplicate: true,
      existingSongId: response.existingSongId,
      existingSongTitle: response.existingSongTitle,
    }
  }

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: (response as ApiResponse<SongWithSlides>).data }
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

export async function rebuildSearchIndex(): Promise<{
  success: boolean
  duration?: number
  error?: string
}> {
  const response = await fetcher<
    ApiResponse<{ success: boolean; duration: number }>
  >('/api/songs/search/rebuild', {
    method: 'POST',
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return {
    success: response.data?.success ?? false,
    duration: response.data?.duration,
  }
}
