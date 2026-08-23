import { parseStyleRanges } from './parseStyleRanges'
import type { BibleBookmark } from './types'
import type { bibleBookmarks } from '../../db/schema'

/**
 * Converts a database record to API format
 */
export function toBookmark(
  record: typeof bibleBookmarks.$inferSelect,
): BibleBookmark {
  return {
    id: record.id,
    verseId: record.verseId,
    reference: record.reference,
    text: record.text,
    translationAbbreviation: record.translationAbbreviation,
    bookName: record.bookName,
    bookCode: record.bookCode,
    translationId: record.translationId,
    bookId: record.bookId,
    chapter: record.chapter,
    verse: record.verse,
    sortOrder: record.sortOrder,
    styleRanges: parseStyleRanges(record.styleRanges),
    createdAt: record.createdAt.getTime(),
  }
}
