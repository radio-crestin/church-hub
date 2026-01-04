import { and, asc, eq } from 'drizzle-orm'

import { getBookByCode } from './books'
import { getDefaultTranslation } from './translations'
import type { BibleSearchResult, BibleVerse, SearchVersesInput } from './types'
import { BOOK_ALIASES } from './types'
import { formatReference, getVerse, getVerseRange } from './verses'
import { getDatabase, getRawDatabase } from '../../db'
import { bibleBooks, bibleVerses } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:search] ${message}`)
}

/**
 * Parsed reference result
 */
interface ParsedReference {
  bookCode: string
  chapter: number
  startVerse?: number
  endVerse?: number
}

/**
 * Gets all verses for a chapter by book code
 */
function getChapterVerses(
  translationId: number,
  bookCode: string,
  chapter: number,
): BibleVerse[] {
  const db = getDatabase()
  const records = db
    .select({
      id: bibleVerses.id,
      translationId: bibleVerses.translationId,
      bookId: bibleVerses.bookId,
      bookCode: bibleBooks.bookCode,
      bookName: bibleBooks.bookName,
      chapter: bibleVerses.chapter,
      verse: bibleVerses.verse,
      text: bibleVerses.text,
    })
    .from(bibleVerses)
    .innerJoin(bibleBooks, eq(bibleBooks.id, bibleVerses.bookId))
    .where(
      and(
        eq(bibleVerses.translationId, translationId),
        eq(bibleBooks.bookCode, bookCode.toUpperCase()),
        eq(bibleVerses.chapter, chapter),
      ),
    )
    .orderBy(asc(bibleVerses.verse))
    .all()

  return records.map((r) => ({
    id: r.id,
    translationId: r.translationId,
    bookId: r.bookId,
    bookCode: r.bookCode,
    bookName: r.bookName,
    chapter: r.chapter,
    verse: r.verse,
    text: r.text,
  }))
}

/**
 * Parses a Bible reference string like "Gen", "Gen 1", "Gen 1:23" or "Ioan 3:16-18"
 * Returns null if the string doesn't match a reference pattern
 */
export function parseReference(query: string): ParsedReference | null {
  // Normalize the query
  const normalized = query.trim().toLowerCase()

  // Pattern: Book [Chapter[:Verse[-EndVerse]]]
  // Examples: "gen", "gen 1", "gen 1:1", "gen 1 1", "psalm 23:1-6", "1 cor 13:4-8"
  // Supports both colon and space as separator between chapter and verse
  const referencePattern =
    /^(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+)(?:\s+(\d+)(?:[:\s]+(\d+)(?:-(\d+))?)?)?$/i

  const match = normalized.match(referencePattern)
  if (!match) {
    return null
  }

  const [, bookPart, chapterStr, startVerseStr, endVerseStr] = match

  // Normalize book name (remove spaces, lowercase)
  const bookName = bookPart.replace(/\s+/g, '').toLowerCase()

  // Look up book code from aliases
  const bookCode = BOOK_ALIASES[bookName]
  if (!bookCode) {
    log('debug', `Unknown book name: ${bookName}`)
    return null
  }

  // Default to chapter 1 if no chapter specified
  const chapter = chapterStr ? Number.parseInt(chapterStr, 10) : 1
  const startVerse = startVerseStr
    ? Number.parseInt(startVerseStr, 10)
    : undefined
  const endVerse = endVerseStr ? Number.parseInt(endVerseStr, 10) : startVerse

  return {
    bookCode,
    chapter,
    startVerse,
    endVerse,
  }
}

/**
 * Checks if a query looks like a reference (for UI hints)
 */
export function looksLikeReference(query: string): boolean {
  // Check if query starts with a book name pattern
  const normalized = query.trim().toLowerCase()

  // Simple heuristic: contains a number after some text
  const hasBookAndChapter = /^(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+)\s*\d/.test(normalized)

  return hasBookAndChapter
}

/**
 * Search by reference - returns specific verse(s)
 */
export function searchByReference(
  query: string,
  translationId?: number,
): BibleVerse[] {
  const parsed = parseReference(query)
  if (!parsed) {
    return []
  }

  // Get translation ID if not provided
  let effectiveTranslationId = translationId
  if (!effectiveTranslationId) {
    const defaultTranslation = getDefaultTranslation()
    if (!defaultTranslation) {
      log('warning', 'No translations available')
      return []
    }
    effectiveTranslationId = defaultTranslation.id
  }

  // Check if book exists in this translation
  const book = getBookByCode(effectiveTranslationId, parsed.bookCode)
  if (!book) {
    log(
      'debug',
      `Book ${parsed.bookCode} not found in translation ${effectiveTranslationId}`,
    )
    return []
  }

  // If no verse specified, return all verses of the chapter
  if (parsed.startVerse === undefined) {
    return getChapterVerses(
      effectiveTranslationId,
      parsed.bookCode,
      parsed.chapter,
    )
  }

  // If range specified, get range
  if (parsed.endVerse !== undefined && parsed.endVerse !== parsed.startVerse) {
    return getVerseRange(
      effectiveTranslationId,
      parsed.bookCode,
      parsed.chapter,
      parsed.startVerse,
      parsed.endVerse,
    )
  }

  // Single verse
  const verse = getVerse(
    effectiveTranslationId,
    parsed.bookCode,
    parsed.chapter,
    parsed.startVerse,
  )
  return verse ? [verse] : []
}

/**
 * Full-text search across verse content
 * Uses raw SQL for FTS5 MATCH queries (not supported by Drizzle)
 */
export function searchVersesByText(
  input: SearchVersesInput,
): BibleSearchResult[] {
  const rawDb = getRawDatabase()
  const { query, translationId, limit = 50 } = input

  if (!query || query.trim().length < 2) {
    return []
  }

  // Escape special FTS characters
  const sanitizedQuery = query
    .replace(/['"]/g, '')
    .replace(/[*()]/g, ' ')
    .trim()

  if (!sanitizedQuery) {
    return []
  }

  log('debug', `Searching for: "${sanitizedQuery}"`)

  try {
    // Build the query based on whether we're filtering by translation
    let sql: string
    let params: (string | number)[]

    if (translationId) {
      sql = `
        SELECT
          v.id,
          v.translation_id,
          v.book_id,
          b.book_name,
          b.book_code,
          v.chapter,
          v.verse,
          v.text,
          highlight(bible_verses_fts, 0, '<mark>', '</mark>') as highlighted_text
        FROM bible_verses_fts fts
        JOIN bible_verses v ON v.id = fts.rowid
        JOIN bible_books b ON b.id = v.book_id
        WHERE bible_verses_fts MATCH ?
          AND v.translation_id = ?
        ORDER BY bm25(bible_verses_fts)
        LIMIT ?
      `
      params = [sanitizedQuery, translationId, limit]
    } else {
      sql = `
        SELECT
          v.id,
          v.translation_id,
          v.book_id,
          b.book_name,
          b.book_code,
          v.chapter,
          v.verse,
          v.text,
          highlight(bible_verses_fts, 0, '<mark>', '</mark>') as highlighted_text
        FROM bible_verses_fts fts
        JOIN bible_verses v ON v.id = fts.rowid
        JOIN bible_books b ON b.id = v.book_id
        WHERE bible_verses_fts MATCH ?
        ORDER BY bm25(bible_verses_fts)
        LIMIT ?
      `
      params = [sanitizedQuery, limit]
    }

    const results = rawDb.query(sql).all(...params) as Array<{
      id: number
      translation_id: number
      book_id: number
      book_name: string
      book_code: string
      chapter: number
      verse: number
      text: string
      highlighted_text: string
    }>

    return results.map((r) => ({
      id: r.id,
      translationId: r.translation_id,
      bookId: r.book_id,
      bookName: r.book_name,
      bookCode: r.book_code,
      chapter: r.chapter,
      verse: r.verse,
      text: r.text,
      reference: formatReference(r.book_name, r.chapter, r.verse),
      highlightedText: r.highlighted_text || r.text,
    }))
  } catch (error) {
    log('error', `Search failed: ${error}`)
    return []
  }
}

/**
 * Combined search - tries reference first, falls back to text search
 */
export function searchBible(input: SearchVersesInput): {
  type: 'reference' | 'text'
  results: BibleVerse[] | BibleSearchResult[]
} {
  const { query, translationId } = input

  // First try to parse as a reference
  const referenceResults = searchByReference(query, translationId)
  if (referenceResults.length > 0) {
    return {
      type: 'reference',
      results: referenceResults,
    }
  }

  // Fall back to text search
  const textResults = searchVersesByText(input)
  return {
    type: 'text',
    results: textResults,
  }
}

/**
 * Updates the FTS index for a translation
 * Uses raw SQL for FTS operations (not supported by Drizzle)
 */
export function updateSearchIndex(translationId: number): void {
  const rawDb = getRawDatabase()

  log('info', `Updating FTS index for translation ${translationId}`)

  // Remove existing entries for this translation
  rawDb.run(
    `
    DELETE FROM bible_verses_fts
    WHERE rowid IN (SELECT id FROM bible_verses WHERE translation_id = ?)
  `,
    translationId,
  )

  // Re-add entries
  rawDb.run(
    `
    INSERT INTO bible_verses_fts (rowid, text)
    SELECT id, text FROM bible_verses WHERE translation_id = ?
  `,
    translationId,
  )

  log('info', 'FTS index updated')
}

/**
 * Rebuilds the entire Bible FTS index
 * Uses raw SQL for FTS operations (not supported by Drizzle)
 */
export function rebuildSearchIndex(): void {
  const rawDb = getRawDatabase()

  log('info', 'Rebuilding entire Bible FTS index')

  // For FTS5 tables with external content (content=bible_verses),
  // use the 'rebuild' command which re-reads from the content table
  try {
    rawDb.exec(
      "INSERT INTO bible_verses_fts(bible_verses_fts) VALUES('rebuild')",
    )
  } catch (error) {
    // If rebuild fails (e.g., table doesn't exist or is corrupted), recreate it
    log('warning', `FTS rebuild command failed, recreating table: ${error}`)

    // Drop and recreate the FTS table
    rawDb.exec('DROP TABLE IF EXISTS bible_verses_fts')
    rawDb.exec(`
      CREATE VIRTUAL TABLE bible_verses_fts USING fts5(
        text,
        content=bible_verses,
        content_rowid=id,
        tokenize='unicode61 remove_diacritics 2'
      )
    `)

    // Now rebuild
    rawDb.exec(
      "INSERT INTO bible_verses_fts(bible_verses_fts) VALUES('rebuild')",
    )
  }

  // Count indexed verses
  const count = rawDb
    .query<{ count: number }, []>(
      'SELECT COUNT(*) as count FROM bible_verses_fts',
    )
    .get()?.count

  log('info', `FTS index rebuilt: ${count ?? 0} verses indexed`)
}
