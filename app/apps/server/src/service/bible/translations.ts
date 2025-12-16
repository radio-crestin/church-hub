import { asc, count, eq } from 'drizzle-orm'

import type { BibleTranslation, OperationResult } from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { bibleBooks, bibleTranslations, bibleVerses } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:translations] ${message}`)
}

/**
 * Converts a database record to API format
 */
function toTranslation(
  record: typeof bibleTranslations.$inferSelect,
  bookCount: number,
  verseCount: number,
): BibleTranslation {
  return {
    id: record.id,
    name: record.name,
    abbreviation: record.abbreviation,
    language: record.language,
    sourceFilename: record.sourceFilename,
    bookCount,
    verseCount,
    createdAt:
      record.createdAt instanceof Date
        ? Math.floor(record.createdAt.getTime() / 1000)
        : (record.createdAt as unknown as number),
    updatedAt:
      record.updatedAt instanceof Date
        ? Math.floor(record.updatedAt.getTime() / 1000)
        : (record.updatedAt as unknown as number),
  }
}

/**
 * Gets counts for a translation
 */
function getCounts(translationId: number): {
  bookCount: number
  verseCount: number
} {
  const db = getDatabase()

  const bookResult = db
    .select({ count: count() })
    .from(bibleBooks)
    .where(eq(bibleBooks.translationId, translationId))
    .get()

  const verseResult = db
    .select({ count: count() })
    .from(bibleVerses)
    .where(eq(bibleVerses.translationId, translationId))
    .get()

  return {
    bookCount: bookResult?.count ?? 0,
    verseCount: verseResult?.count ?? 0,
  }
}

/**
 * Gets all Bible translations with book and verse counts
 */
export function getAllTranslations(): BibleTranslation[] {
  const db = getDatabase()
  const records = db
    .select()
    .from(bibleTranslations)
    .orderBy(asc(bibleTranslations.name))
    .all()

  return records.map((record) => {
    const counts = getCounts(record.id)
    return toTranslation(record, counts.bookCount, counts.verseCount)
  })
}

/**
 * Gets a single translation by ID
 */
export function getTranslationById(id: number): BibleTranslation | null {
  const db = getDatabase()
  const record = db
    .select()
    .from(bibleTranslations)
    .where(eq(bibleTranslations.id, id))
    .get()

  if (!record) return null

  const counts = getCounts(record.id)
  return toTranslation(record, counts.bookCount, counts.verseCount)
}

/**
 * Gets a translation by abbreviation
 */
export function getTranslationByAbbreviation(
  abbreviation: string,
): BibleTranslation | null {
  const db = getDatabase()
  const record = db
    .select()
    .from(bibleTranslations)
    .where(eq(bibleTranslations.abbreviation, abbreviation.toUpperCase()))
    .get()

  if (!record) return null

  const counts = getCounts(record.id)
  return toTranslation(record, counts.bookCount, counts.verseCount)
}

/**
 * Gets the default (first) translation
 */
export function getDefaultTranslation(): BibleTranslation | null {
  const db = getDatabase()
  const record = db
    .select()
    .from(bibleTranslations)
    .orderBy(asc(bibleTranslations.createdAt))
    .limit(1)
    .get()

  if (!record) return null

  const counts = getCounts(record.id)
  return toTranslation(record, counts.bookCount, counts.verseCount)
}

/**
 * Deletes a translation and all associated data (books, verses, FTS entries)
 */
export function deleteTranslation(id: number): OperationResult {
  const db = getDatabase()
  const rawDb = getRawDatabase()

  try {
    // Check if translation exists
    const existing = db
      .select({ id: bibleTranslations.id })
      .from(bibleTranslations)
      .where(eq(bibleTranslations.id, id))
      .get()

    if (!existing) {
      return {
        success: false,
        error: 'Translation not found',
      }
    }

    log('info', `Deleting translation ID: ${id}`)

    // Start transaction using raw DB for FTS operations
    rawDb.exec('BEGIN TRANSACTION')

    try {
      // Remove from FTS index first (must use raw SQL for FTS)
      rawDb.run(
        `
        DELETE FROM bible_verses_fts
        WHERE rowid IN (SELECT id FROM bible_verses WHERE translation_id = ?)
      `,
        [id],
      )

      // Delete verses
      db.delete(bibleVerses).where(eq(bibleVerses.translationId, id)).run()

      // Delete books
      db.delete(bibleBooks).where(eq(bibleBooks.translationId, id)).run()

      // Delete translation
      db.delete(bibleTranslations).where(eq(bibleTranslations.id, id)).run()

      rawDb.exec('COMMIT')

      log('info', `Successfully deleted translation ID: ${id}`)

      return { success: true }
    } catch (error) {
      rawDb.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to delete translation: ${error}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Checks if any translations exist
 */
export function hasTranslations(): boolean {
  const db = getDatabase()
  const result = db.select({ count: count() }).from(bibleTranslations).get()
  return (result?.count ?? 0) > 0
}
