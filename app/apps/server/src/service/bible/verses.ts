import { and, asc, between, eq, gt, gte, lt, lte, or } from 'drizzle-orm'

import type { BibleVerse } from './types'
import { getDatabase } from '../../db'
import { bibleBooks, bibleVerses } from '../../db/schema'

type VerseWithBook = typeof bibleVerses.$inferSelect & {
  bookCode: string
  bookName: string
}

/**
 * Converts a database record to API format
 */
function toVerse(record: VerseWithBook): BibleVerse {
  return {
    id: record.id,
    translationId: record.translationId,
    bookId: record.bookId,
    bookCode: record.bookCode,
    bookName: record.bookName,
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
    .select({
      id: bibleVerses.id,
      translationId: bibleVerses.translationId,
      bookId: bibleVerses.bookId,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
      bookCode: bibleBooks.bookCode,
      bookName: bibleBooks.bookName,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(
      and(eq(bibleVerses.bookId, bookId), eq(bibleVerses.chapter, chapter)),
    )
    .orderBy(asc(bibleVerses.verse))
    .all()

  return records.map(toVerse)
}

/**
 * Gets a single verse by ID
 */
export function getVerseById(verseId: number): BibleVerse | null {
  const db = getDatabase()
  const record = db
    .select({
      id: bibleVerses.id,
      translationId: bibleVerses.translationId,
      bookId: bibleVerses.bookId,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
      bookCode: bibleBooks.bookCode,
      bookName: bibleBooks.bookName,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(eq(bibleVerses.id, verseId))
    .get()

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
    .select({
      id: bibleVerses.id,
      translationId: bibleVerses.translationId,
      bookId: bibleVerses.bookId,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
      bookCode: bibleBooks.bookCode,
      bookName: bibleBooks.bookName,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(
      and(
        eq(bibleVerses.translationId, translationId),
        eq(bibleBooks.bookCode, bookCode.toUpperCase()),
        eq(bibleVerses.chapter, chapter),
        eq(bibleVerses.verse, verseNumber),
      ),
    )
    .get()

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
    .select({
      id: bibleVerses.id,
      translationId: bibleVerses.translationId,
      bookId: bibleVerses.bookId,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
      bookCode: bibleBooks.bookCode,
      bookName: bibleBooks.bookName,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(
      and(
        eq(bibleVerses.translationId, translationId),
        eq(bibleBooks.bookCode, bookCode.toUpperCase()),
        eq(bibleVerses.chapter, chapter),
        between(bibleVerses.verse, startVerse, endVerse),
      ),
    )
    .orderBy(asc(bibleVerses.verse))
    .all()

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
    .select({
      id: bibleVerses.id,
      translationId: bibleVerses.translationId,
      bookId: bibleVerses.bookId,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
      bookCode: bibleBooks.bookCode,
      bookName: bibleBooks.bookName,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(
      and(
        eq(bibleVerses.translationId, translationId),
        eq(bibleBooks.bookCode, bookCode.toUpperCase()),
        or(
          and(
            eq(bibleVerses.chapter, startChapter),
            gte(bibleVerses.verse, startVerse),
          ),
          and(
            gt(bibleVerses.chapter, startChapter),
            lt(bibleVerses.chapter, endChapter),
          ),
          and(
            eq(bibleVerses.chapter, endChapter),
            lte(bibleVerses.verse, endVerse),
          ),
        ),
      ),
    )
    .orderBy(asc(bibleVerses.chapter), asc(bibleVerses.verse))
    .all()

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
