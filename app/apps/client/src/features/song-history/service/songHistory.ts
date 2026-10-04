import { fetcher } from '~/utils/fetcher'
import type {
  RestoreSide,
  SongHistoryEntry,
  SongHistoryEntrySummary,
} from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getSongHistory(
  songId: number,
): Promise<SongHistoryEntrySummary[]> {
  const response = await fetcher<ApiResponse<SongHistoryEntrySummary[]>>(
    `/api/songs/${songId}/history`,
  )
  return response.data ?? []
}

export async function getSongHistoryEntry(
  songId: number,
  entryId: number,
): Promise<SongHistoryEntry | null> {
  const response = await fetcher<ApiResponse<SongHistoryEntry>>(
    `/api/songs/${songId}/history/${entryId}`,
  )
  return response.data ?? null
}

/** Puts the song back to one side of an entry. Throws with the server's reason. */
export async function restoreSongVersion(
  songId: number,
  entryId: number,
  side: RestoreSide,
): Promise<void> {
  const response = await fetcher<ApiResponse<unknown>>(
    `/api/songs/${songId}/history/${entryId}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side }),
    },
  )
  if (response.error) throw new Error(response.error)
}
