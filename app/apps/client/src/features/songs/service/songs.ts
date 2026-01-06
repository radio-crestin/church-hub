import { fetcher } from '~/utils/fetcher'
import type {
  AISearchResponse,
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

export interface PaginatedSongsResult {
  songs: Song[]
  total: number
  hasMore: boolean
}

export async function getSongsPaginated(
  limit: number,
  offset: number,
  categoryId?: number,
  signal?: AbortSignal,
): Promise<PaginatedSongsResult> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (categoryId !== undefined) {
    params.set('categoryId', String(categoryId))
  }
  const response = await fetcher<ApiResponse<PaginatedSongsResult>>(
    `/api/songs?${params.toString()}`,
    { signal, cache: 'no-store' },
  )
  return response.data ?? { songs: [], total: 0, hasMore: false }
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
  categoryId?: number,
  signal?: AbortSignal,
): Promise<SongSearchResult[]> {
  const params = new URLSearchParams()
  params.set('q', query)
  if (categoryId !== undefined) {
    params.set('categoryId', String(categoryId))
  }
  const response = await fetcher<ApiResponse<SongSearchResult[]>>(
    `/api/songs/search?${params.toString()}`,
    { signal, cache: 'no-store' },
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

export async function aiSearchSongs(
  query: string,
  categoryId?: number,
  signal?: AbortSignal,
): Promise<AISearchResponse> {
  const response = await fetcher<ApiResponse<AISearchResponse>>(
    '/api/songs/ai-search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, categoryId }),
      signal,
    },
  )
  return (
    response.data ?? {
      results: [],
      termsUsed: [],
      totalCandidates: 0,
      processingTimeMs: 0,
    }
  )
}
