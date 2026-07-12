import { fetcher } from '../../../utils/fetcher'

export interface SongBookmark {
  id: number
  songId: number
  songTitle: string
  songCategoryName: string | null
  songKeyLine: string | null
  songTagNames: string[]
  sortOrder: number
  /** Manual "already sung" marker toggled from the bookmarks list. */
  isSung: boolean
  /** When it was marked sung (ms epoch), or null. */
  sungAt: number | null
  createdAt: number
}

export async function getBookmarks(): Promise<SongBookmark[]> {
  const response = await fetcher<{ data: SongBookmark[] }>(
    '/api/song-bookmarks',
  )
  return response.data ?? []
}

export async function addBookmark(
  songId: number,
): Promise<SongBookmark | null> {
  const response = await fetcher<{ data: SongBookmark }>(
    '/api/song-bookmarks',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId }),
    },
  )
  return response.data ?? null
}

export async function removeBookmark(songId: number): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    `/api/song-bookmarks/${songId}`,
    { method: 'DELETE' },
  )
  return response.success ?? false
}

export async function clearBookmarks(): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>('/api/song-bookmarks', {
    method: 'DELETE',
  })
  return response.success ?? false
}

export async function markBookmarkSung(
  songId: number,
  isSung: boolean,
): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    `/api/song-bookmarks/${songId}/sung`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSung }),
    },
  )
  return response.success ?? false
}

export async function reorderBookmarks(songIds: number[]): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    '/api/song-bookmarks/reorder',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songIds }),
    },
  )
  return response.success ?? false
}
