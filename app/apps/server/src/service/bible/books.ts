import type { BibleBook, BibleBookRecord } from './types'
import { getDatabase } from '../../db'

/**
 * Converts a database record to API format
 */
function toBook(record: BibleBookRecord): BibleBook {
  return {
    id: record.id,
    translationId: record.translation_id,
    bookCode: record.book_code,
    bookName: record.book_name,
    bookOrder: record.book_order,
    chapterCount: record.chapter_count,
  }
}

/**
 * Gets all books for a translation
 */
export function getBooksByTranslation(translationId: number): BibleBook[] {
  const db = getDatabase()
  const records = db
    .query(`
      SELECT * FROM bible_books
      WHERE translation_id = ?
      ORDER BY book_order ASC
    `)
    .all(translationId) as BibleBookRecord[]

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
    .query(`
      SELECT * FROM bible_books
      WHERE translation_id = ? AND book_code = ?
    `)
    .get(translationId, bookCode.toUpperCase()) as BibleBookRecord | null

  return record ? toBook(record) : null
}

/**
 * Gets a book by ID
 */
export function getBookById(bookId: number): BibleBook | null {
  const db = getDatabase()
  const record = db
    .query('SELECT * FROM bible_books WHERE id = ?')
    .get(bookId) as BibleBookRecord | null

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
    .query(`
      SELECT chapter, COUNT(*) as verse_count
      FROM bible_verses
      WHERE book_id = ?
      GROUP BY chapter
      ORDER BY chapter ASC
    `)
    .all(bookId) as Array<{ chapter: number; verse_count: number }>

  return chapters.map((c) => ({
    chapter: c.chapter,
    verseCount: c.verse_count,
  }))
}
