import { fetcher } from '../../../utils/fetcher'

/**
 * A run of styling drawn over the verse text, by character offset.
 * Mirrors the live slide's `TextStyleRange`.
 */
export interface BibleBookmarkStyleRange {
  id: string
  start: number
  end: number
  highlight?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontScale?: number
}

export interface BibleBookmark {
  id: number
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  bookName: string
  bookCode: string
  translationId: number
  bookId: number
  chapter: number
  verse: number
  sortOrder: number
  /** Highlights/bold/underline saved with the verse, empty when none. */
  styleRanges: BibleBookmarkStyleRange[]
  createdAt: number
}

export interface BibleBookmarkNote {
  id: number
  content: string
  sortOrder: number
  createdAt: number
}

export interface BibleBookmarkItemRef {
  type: 'verse' | 'note'
  id: number
}

export interface BibleBookmarkImportError {
  line: number
  content: string
  reason:
    | 'unknown_reference'
    | 'verse_required'
    | 'verse_not_found'
    | 'no_translation'
}

export interface BibleBookmarkImportResult {
  imported: number
  notes: number
  errors: BibleBookmarkImportError[]
}

export async function getBookmarks(): Promise<BibleBookmark[]> {
  const response = await fetcher<{ data: BibleBookmark[] }>(
    '/api/bible-bookmarks',
  )
  return response.data ?? []
}

/**
 * Bookmarks a verse, optionally keeping the highlights and underlines drawn on
 * it. The ranges are character offsets into this verse's text, so only pass
 * ranges that were actually drawn on it.
 */
export async function addBookmark(
  verseId: number,
  styleRanges?: BibleBookmarkStyleRange[],
): Promise<BibleBookmark | null> {
  const response = await fetcher<{ data: BibleBookmark }>(
    '/api/bible-bookmarks',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verseId, styleRanges }),
    },
  )
  return response.data ?? null
}

/** Removes one bookmark row. Keyed on the bookmark, since a verse may be
 *  bookmarked several times. */
export async function removeBookmark(bookmarkId: number): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    `/api/bible-bookmarks/${bookmarkId}`,
    { method: 'DELETE' },
  )
  return response.success ?? false
}

export async function clearBookmarks(): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>('/api/bible-bookmarks', {
    method: 'DELETE',
  })
  return response.success ?? false
}

export async function getBookmarkNotes(): Promise<BibleBookmarkNote[]> {
  const response = await fetcher<{ data: BibleBookmarkNote[] }>(
    '/api/bible-bookmark-notes',
  )
  return response.data ?? []
}

export async function addBookmarkNote(
  content: string,
): Promise<BibleBookmarkNote | null> {
  const response = await fetcher<{ data: BibleBookmarkNote }>(
    '/api/bible-bookmark-notes',
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
    `/api/bible-bookmark-notes/${id}`,
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
    `/api/bible-bookmark-notes/${id}`,
    { method: 'DELETE' },
  )
  return response.success ?? false
}

/** Sends the whole list, not just the moved rows: verses and notes share one
 *  ordering sequence, so a partial list would interleave them wrongly. */
export async function reorderBookmarkItems(
  items: BibleBookmarkItemRef[],
): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>(
    '/api/bible-bookmarks/reorder-items',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    },
  )
  return response.success ?? false
}

export async function exportBookmarksAsText(): Promise<string> {
  const response = await fetcher<{ data: string }>(
    '/api/bible-bookmarks/export',
  )
  return response.data ?? ''
}

export async function importBookmarksFromText(
  text: string,
  translationId?: number,
): Promise<BibleBookmarkImportResult> {
  const response = await fetcher<{ data: BibleBookmarkImportResult }>(
    '/api/bible-bookmarks/import',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, translationId }),
    },
  )
  return response.data ?? { imported: 0, notes: 0, errors: [] }
}
