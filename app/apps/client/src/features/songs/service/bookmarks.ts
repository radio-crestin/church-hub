import { fetcher } from '../../../utils/fetcher'

export interface SongBookmark {
  id: number
  songId: number
  songTitle: string
  songCategoryName: string | null
  songKeyLine: string | null
  sortOrder: number
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
