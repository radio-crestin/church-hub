import { and, asc, count, eq, gt } from 'drizzle-orm'

import type { BibleBook } from './types'
import { getDatabase } from '../../db'
import { bibleBooks, bibleVerses } from '../../db/schema'

/**
 * Converts a database record to API format
 */
function toBook(record: typeof bibleBooks.$inferSelect): BibleBook {
  return {
    id: record.id,
    translationId: record.translationId,
    bookCode: record.bookCode,
    bookName: record.bookName,
    bookOrder: record.bookOrder,
    chapterCount: record.chapterCount,
  }
}

/**
 * Gets all books for a translation
 */
export function getBooksByTranslation(translationId: number): BibleBook[] {
  const db = getDatabase()
  const records = db
    .select()
    .from(bibleBooks)
    .where(eq(bibleBooks.translationId, translationId))
    .orderBy(asc(bibleBooks.bookOrder))
    .all()

  return records.map(toBook)
}

/**
 * Gets a book by translation ID and book code
 */
export function getBookByCode(
  translationId: number,
  bookCode: string,
): BibleBook | null {
  const db = getDatabase()
  const record = db
    .select()
    .from(bibleBooks)
    .where(
      and(
        eq(bibleBooks.translationId, translationId),
        eq(bibleBooks.bookCode, bookCode.toUpperCase()),
      ),
    )
    .get()

  return record ? toBook(record) : null
}

/**
 * Gets a book by ID
 */
export function getBookById(bookId: number): BibleBook | null {
  const db = getDatabase()
  const record = db
    .select()
    .from(bibleBooks)
    .where(eq(bibleBooks.id, bookId))
    .get()

  return record ? toBook(record) : null
}

/**
 * Gets chapter info for a book (list of chapter numbers with verse counts)
 */
export function getChaptersForBook(
  bookId: number,
): Array<{ chapter: number; verseCount: number }> {
  const db = getDatabase()
  const chapters = db
    .select({
      chapter: bibleVerses.chapter,
      verseCount: count(),
    })
    .from(bibleVerses)
    .where(eq(bibleVerses.bookId, bookId))
    .groupBy(bibleVerses.chapter)
    .orderBy(asc(bibleVerses.chapter))
    .all()

  return chapters.map((c) => ({
    chapter: c.chapter,
    verseCount: c.verseCount,
  }))
}

/**
 * Gets the next book in sequence for a translation
 * Used for navigating from the end of one book to the beginning of the next
 */
export function getNextBook(
  translationId: number,
  currentBookId: number,
): BibleBook | null {
  const currentBook = getBookById(currentBookId)
  if (!currentBook) return null

  const db = getDatabase()
  const nextBook = db
    .select()
    .from(bibleBooks)
    .where(
      and(
        eq(bibleBooks.translationId, translationId),
        gt(bibleBooks.bookOrder, currentBook.bookOrder),
      ),
    )
    .orderBy(asc(bibleBooks.bookOrder))
    .limit(1)
    .get()

  return nextBook ? toBook(nextBook) : null
}
