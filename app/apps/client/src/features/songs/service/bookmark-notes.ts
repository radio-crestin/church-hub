import { fetcher } from '../../../utils/fetcher'

export interface BookmarkNote {
  id: number
  content: string
  sortOrder: number
  createdAt: number
}

export interface BookmarkItemRef {
  type: 'song' | 'note'
  id: number
}

export async function getBookmarkNotes(): Promise<BookmarkNote[]> {
  const response = await fetcher<{ data: BookmarkNote[] }>(
    '/api/song-bookmark-notes',
  )
  return response.data ?? []
}

export async function addBookmarkNote(
  content: string,
): Promise<BookmarkNote | null> {
  const response = await fetcher<{ data: BookmarkNote }>(
    '/api/song-bookmark-notes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  )
  return response.data ?? null
}

export async function updateBookmarkNote(
  id: number,
  content: string,
): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    `/api/song-bookmark-notes/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  )
  return response.success ?? false
}

export async function removeBookmarkNote(id: number): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    `/api/song-bookmark-notes/${id}`,
    { method: 'DELETE' },
  )
  return response.success ?? false
}

export async function reorderBookmarkItems(
  items: BookmarkItemRef[],
): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    '/api/song-bookmarks/reorder-items',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    },
  )
  return response.success ?? false
}

export async function exportBookmarksAsText(): Promise<string> {
  const response = await fetcher<{ data: string }>('/api/song-bookmarks/export')
  return response.data ?? ''
}
