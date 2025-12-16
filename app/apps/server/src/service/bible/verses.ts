import type { BibleVerse, BibleVerseRecord } from './types'
import { getDatabase } from '../../db'

/**
 * Converts a database record to API format
 */
function toVerse(
  record: BibleVerseRecord & { book_code: string; book_name: string },
): BibleVerse {
  return {
    id: record.id,
    translationId: record.translation_id,
    bookId: record.book_id,
    bookCode: record.book_code,
    bookName: record.book_name,
    chapter: record.chapter,
    verse: record.verse,
    text: record.text,
  }
}

/**
 * Gets all verses for a chapter
 */
export function getVersesByChapter(
  bookId: number,
  chapter: number,
): BibleVerse[] {
  const db = getDatabase()
  const records = db
    .query(`
      SELECT v.*, b.book_code, b.book_name
      FROM bible_verses v
      JOIN bible_books b ON b.id = v.book_id
      WHERE v.book_id = ? AND v.chapter = ?
      ORDER BY v.verse ASC
    `)
    .all(bookId, chapter) as Array<
    BibleVerseRecord & { book_code: string; book_name: string }
  >

  return records.map(toVerse)
}

/**
 * Gets a single verse by ID
 */
export function getVerseById(verseId: number): BibleVerse | null {
  const db = getDatabase()
  const record = db
    .query(`
      SELECT v.*, b.book_code, b.book_name
      FROM bible_verses v
      JOIN bible_books b ON b.id = v.book_id
      WHERE v.id = ?
    `)
    .get(verseId) as
    | (BibleVerseRecord & { book_code: string; book_name: string })
    | null

  return record ? toVerse(record) : null
}

/**
 * Gets a specific verse by book, chapter, and verse number
 */
export function getVerse(
  translationId: number,
  bookCode: string,
  chapter: number,
  verseNumber: number,
): BibleVerse | null {
  const db = getDatabase()
  const record = db
    .query(`
      SELECT v.*, b.book_code, b.book_name
      FROM bible_verses v
      JOIN bible_books b ON b.id = v.book_id
      WHERE v.translation_id = ?
        AND b.book_code = ?
        AND v.chapter = ?
        AND v.verse = ?
    `)
    .get(translationId, bookCode.toUpperCase(), chapter, verseNumber) as
    | (BibleVerseRecord & { book_code: string; book_name: string })
    | null

  return record ? toVerse(record) : null
}

/**
 * Gets a range of verses
 */
export function getVerseRange(
  translationId: number,
  bookCode: string,
  chapter: number,
  startVerse: number,
  endVerse: number,
): BibleVerse[] {
  const db = getDatabase()
  const records = db
    .query(`
      SELECT v.*, b.book_code, b.book_name
      FROM bible_verses v
      JOIN bible_books b ON b.id = v.book_id
      WHERE v.translation_id = ?
        AND b.book_code = ?
        AND v.chapter = ?
        AND v.verse >= ?
        AND v.verse <= ?
      ORDER BY v.verse ASC
    `)
    .all(
      translationId,
      bookCode.toUpperCase(),
      chapter,
      startVerse,
      endVerse,
    ) as Array<BibleVerseRecord & { book_code: string; book_name: string }>

  return records.map(toVerse)
}

/**
 * Gets verses across chapter boundary (e.g., John 3:16 - 4:3)
 */
export function getVersesAcrossChapters(
  translationId: number,
  bookCode: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
): BibleVerse[] {
  const db = getDatabase()

  // Get verses from start chapter (from startVerse to end)
  // Get all verses from middle chapters
  // Get verses from end chapter (from 1 to endVerse)
  const records = db
    .query(`
      SELECT v.*, b.book_code, b.book_name
      FROM bible_verses v
      JOIN bible_books b ON b.id = v.book_id
      WHERE v.translation_id = ?
        AND b.book_code = ?
        AND (
          (v.chapter = ? AND v.verse >= ?) OR
          (v.chapter > ? AND v.chapter < ?) OR
          (v.chapter = ? AND v.verse <= ?)
        )
      ORDER BY v.chapter ASC, v.verse ASC
    `)
    .all(
      translationId,
      bookCode.toUpperCase(),
      startChapter,
      startVerse,
      startChapter,
      endChapter,
      endChapter,
      endVerse,
    ) as Array<BibleVerseRecord & { book_code: string; book_name: string }>

  return records.map(toVerse)
}

/**
 * Formats a verse reference string
 */
export function formatReference(
  bookName: string,
  chapter: number,
  verse: number,
  translationAbbreviation?: string,
): string {
  const ref = `${bookName} ${chapter}:${verse}`
  return translationAbbreviation ? `${ref} - ${translationAbbreviation}` : ref
}

/**
 * Formats a verse range reference string
 */
export function formatRangeReference(
  bookName: string,
  chapter: number,
  startVerse: number,
  endVerse: number,
  translationAbbreviation?: string,
): string {
  const ref =
    startVerse === endVerse
      ? `${bookName} ${chapter}:${startVerse}`
      : `${bookName} ${chapter}:${startVerse}-${endVerse}`
  return translationAbbreviation ? `${ref} - ${translationAbbreviation}` : ref
}
