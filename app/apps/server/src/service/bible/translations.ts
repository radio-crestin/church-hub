import type {
  BibleTranslation,
  BibleTranslationRecord,
  OperationResult,
} from './types'
import { getDatabase } from '../../db'

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
  record: BibleTranslationRecord & { book_count: number; verse_count: number },
): BibleTranslation {
  return {
    id: record.id,
    name: record.name,
    abbreviation: record.abbreviation,
    language: record.language,
    sourceFilename: record.source_filename,
    bookCount: record.book_count,
    verseCount: record.verse_count,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all Bible translations with book and verse counts
 */
export function getAllTranslations(): BibleTranslation[] {
  const db = getDatabase()
  const records = db
    .query(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM bible_books WHERE translation_id = t.id) as book_count,
        (SELECT COUNT(*) FROM bible_verses WHERE translation_id = t.id) as verse_count
      FROM bible_translations t
      ORDER BY t.name ASC
    `)
    .all() as Array<
    BibleTranslationRecord & { book_count: number; verse_count: number }
  >

  return records.map(toTranslation)
}

/**
 * Gets a single translation by ID
 */
export function getTranslationById(id: number): BibleTranslation | null {
  const db = getDatabase()
  const record = db
    .query(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM bible_books WHERE translation_id = t.id) as book_count,
        (SELECT COUNT(*) FROM bible_verses WHERE translation_id = t.id) as verse_count
      FROM bible_translations t
      WHERE t.id = ?
    `)
    .get(id) as
    | (BibleTranslationRecord & { book_count: number; verse_count: number })
    | null

  return record ? toTranslation(record) : null
}

/**
 * Gets a translation by abbreviation
 */
export function getTranslationByAbbreviation(
  abbreviation: string,
): BibleTranslation | null {
  const db = getDatabase()
  const record = db
    .query(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM bible_books WHERE translation_id = t.id) as book_count,
        (SELECT COUNT(*) FROM bible_verses WHERE translation_id = t.id) as verse_count
      FROM bible_translations t
      WHERE t.abbreviation = ?
    `)
    .get(abbreviation.toUpperCase()) as
    | (BibleTranslationRecord & { book_count: number; verse_count: number })
    | null

  return record ? toTranslation(record) : null
}

/**
 * Gets the default (first) translation
 */
export function getDefaultTranslation(): BibleTranslation | null {
  const db = getDatabase()
  const record = db
    .query(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM bible_books WHERE translation_id = t.id) as book_count,
        (SELECT COUNT(*) FROM bible_verses WHERE translation_id = t.id) as verse_count
      FROM bible_translations t
      ORDER BY t.created_at ASC
      LIMIT 1
    `)
    .get() as
    | (BibleTranslationRecord & { book_count: number; verse_count: number })
    | null

  return record ? toTranslation(record) : null
}

/**
 * Deletes a translation and all associated data (books, verses, FTS entries)
 */
export function deleteTranslation(id: number): OperationResult {
  const db = getDatabase()

  try {
    // Check if translation exists
    const existing = db
      .query('SELECT id FROM bible_translations WHERE id = ?')
      .get(id)

    if (!existing) {
      return {
        success: false,
        error: 'Translation not found',
      }
    }

    log('info', `Deleting translation ID: ${id}`)

    // Start transaction
    db.exec('BEGIN TRANSACTION')

    try {
      // Remove from FTS index first
      db.run(
        `
        DELETE FROM bible_verses_fts
        WHERE rowid IN (SELECT id FROM bible_verses WHERE translation_id = ?)
      `,
        [id],
      )

      // Delete verses (CASCADE should handle this, but explicit for safety)
      db.run('DELETE FROM bible_verses WHERE translation_id = ?', [id])

      // Delete books
      db.run('DELETE FROM bible_books WHERE translation_id = ?', [id])

      // Delete translation
      db.run('DELETE FROM bible_translations WHERE id = ?', [id])

      db.exec('COMMIT')

      log('info', `Successfully deleted translation ID: ${id}`)

      return { success: true }
    } catch (error) {
      db.exec('ROLLBACK')
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
  const result = db
    .query('SELECT COUNT(*) as count FROM bible_translations')
    .get() as { count: number }
  return result.count > 0
}
