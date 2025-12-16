import { getBookByCode } from './books'
import { getDefaultTranslation } from './translations'
import type { BibleSearchResult, BibleVerse, SearchVersesInput } from './types'
import { BOOK_ALIASES } from './types'
import { formatReference, getVerse, getVerseRange } from './verses'
import { getDatabase } from '../../db'

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
 * Parses a Bible reference string like "Gen 1:23" or "Ioan 3:16-18"
 * Returns null if the string doesn't match a reference pattern
 */
export function parseReference(query: string): ParsedReference | null {
  // Normalize the query
  const normalized = query.trim().toLowerCase()

  // Pattern: Book Chapter:Verse or Book Chapter:StartVerse-EndVerse
  // Examples: "gen 1:1", "ioan 3:16", "psalm 23:1-6", "1 cor 13:4-8"
  const referencePattern =
    /^(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+)\s*(\d+)(?::(\d+)(?:-(\d+))?)?$/i

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

  const chapter = Number.parseInt(chapterStr, 10)
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

  // If no verse specified, return first verse of chapter
  if (parsed.startVerse === undefined) {
    const verse = getVerse(
      effectiveTranslationId,
      parsed.bookCode,
      parsed.chapter,
      1,
    )
    return verse ? [verse] : []
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
 */
export function searchVersesByText(
  input: SearchVersesInput,
): BibleSearchResult[] {
  const db = getDatabase()
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

    const results = db.query(sql).all(...params) as Array<{
      id: number
      translation_id: number
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
 */
export function updateSearchIndex(translationId: number): void {
  const db = getDatabase()

  log('info', `Updating FTS index for translation ${translationId}`)

  // Remove existing entries for this translation
  db.run(
    `
    DELETE FROM bible_verses_fts
    WHERE rowid IN (SELECT id FROM bible_verses WHERE translation_id = ?)
  `,
    [translationId],
  )

  // Re-add entries
  db.run(
    `
    INSERT INTO bible_verses_fts (rowid, text)
    SELECT id, text FROM bible_verses WHERE translation_id = ?
  `,
    [translationId],
  )

  log('info', 'FTS index updated')
}

/**
 * Rebuilds the entire Bible FTS index
 */
export function rebuildSearchIndex(): void {
  const db = getDatabase()

  log('info', 'Rebuilding entire Bible FTS index')

  // Clear and rebuild
  db.exec('DELETE FROM bible_verses_fts')
  db.exec(`
    INSERT INTO bible_verses_fts (rowid, text)
    SELECT id, text FROM bible_verses
  `)

  log('info', 'FTS index rebuilt')
}
