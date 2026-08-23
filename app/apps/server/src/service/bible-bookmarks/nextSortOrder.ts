import { sql } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { bibleBookmarkNotes, bibleBookmarks } from '../../db/schema'

/**
 * Next free slot in the ordering sequence shared by bookmarks and notes,
 * so a newly added row always lands at the end of the merged list
 */
export function nextSortOrder(): number {
  const db = getDatabase()

  const maxBookmark = db
    .select({ value: sql<number | null>`MAX(sort_order)` })
    .from(bibleBookmarks)
    .get()
  const maxNote = db
    .select({ value: sql<number | null>`MAX(sort_order)` })
    .from(bibleBookmarkNotes)
    .get()

  return Math.max(maxBookmark?.value ?? -1, maxNote?.value ?? -1) + 1
}
