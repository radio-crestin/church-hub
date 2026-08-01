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

/** Removes one bookmark row. Keyed on the bookmark, since a song may be
 *  bookmarked several times. */
export async function removeBookmark(bookmarkId: number): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    `/api/song-bookmarks/${bookmarkId}`,
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
  bookmarkId: number,
  isSung: boolean,
): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    `/api/song-bookmarks/${bookmarkId}/sung`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSung }),
    },
  )
  return response.success ?? false
}
