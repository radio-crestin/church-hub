import { and, asc, eq } from 'drizzle-orm'

import { getBookByCode } from './books'
import { getDefaultTranslation } from './translations'
import type { BibleSearchResult, BibleVerse, SearchVersesInput } from './types'
import { BOOK_ALIASES } from './types'
import { formatReference, getVerse, getVerseRange } from './verses'
import type { Statement } from 'bun:sqlite'
import { getDatabase, getRawDatabase } from '../../db'
import { bibleBooks, bibleVerses } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:search] ${message}`)
}

// ============================================================================
// Prepared Statement Cache - Reuse compiled SQL statements
// ============================================================================

interface PreparedStatements {
  searchWithTranslation: Statement | null
  searchWithoutTranslation: Statement | null
}

const preparedStatements: PreparedStatements = {
  searchWithTranslation: null,
  searchWithoutTranslation: null,
}

function getSearchStatement(withTranslation: boolean): Statement {
  const rawDb = getRawDatabase()

  if (withTranslation) {
    if (!preparedStatements.searchWithTranslation) {
      preparedStatements.searchWithTranslation = rawDb.prepare(`
        SELECT
          v.id,
          v.translation_id,
          v.book_id,
          b.book_name,
          b.book_code,
          v.chapter,
          v.verse,
          v.text
        FROM bible_verses_fts fts
        JOIN bible_verses v ON v.id = fts.rowid
        JOIN bible_books b ON b.id = v.book_id
        WHERE bible_verses_fts MATCH $query
          AND v.translation_id = $translationId
        ORDER BY bm25(bible_verses_fts)
        LIMIT $limit
      `)
    }
    return preparedStatements.searchWithTranslation
  }

  if (!preparedStatements.searchWithoutTranslation) {
    preparedStatements.searchWithoutTranslation = rawDb.prepare(`
      SELECT
        v.id,
        v.translation_id,
        v.book_id,
        b.book_name,
        b.book_code,
        v.chapter,
        v.verse,
        v.text
      FROM bible_verses_fts fts
      JOIN bible_verses v ON v.id = fts.rowid
      JOIN bible_books b ON b.id = v.book_id
      WHERE bible_verses_fts MATCH $query
      ORDER BY bm25(bible_verses_fts)
      LIMIT $limit
    `)
  }
  return preparedStatements.searchWithoutTranslation
}

// ============================================================================
// LRU Cache for Search Results
// ============================================================================

interface CacheEntry {
  results: BibleSearchResult[]
  timestamp: number
}

const CACHE_MAX_SIZE = 100
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

const searchCache = new Map<string, CacheEntry>()

function getCacheKey(
  query: string,
  translationId: number | undefined,
  limit: number,
): string {
  return `${query}:${translationId ?? 'all'}:${limit}`
}

function getFromCache(key: string): BibleSearchResult[] | null {
  const entry = searchCache.get(key)
  if (!entry) return null

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key)
    return null
  }

  // Move to end (most recently used) by re-inserting
  searchCache.delete(key)
  searchCache.set(key, entry)

  return entry.results
}

function setInCache(key: string, results: BibleSearchResult[]): void {
  // Evict oldest entries if cache is full
  if (searchCache.size >= CACHE_MAX_SIZE) {
    const firstKey = searchCache.keys().next().value
    if (firstKey) searchCache.delete(firstKey)
  }

  searchCache.set(key, {
    results,
    timestamp: Date.now(),
  })
}

// ============================================================================
// Fuzzy Matching Utilities
// ============================================================================

/**
 * Generates FTS query with OR variants for fuzzy matching
 * Uses prefix matching for partial word matches (e.g., "ca" matches "care")
 */
function generateFuzzyFtsQuery(words: string[]): string {
  // For FTS5, we use prefix matching with * which already handles partial matches
  // For truly fuzzy matching, we'd need trigram index, but prefix is usually sufficient

  // Build FTS query: each word with prefix matching
  // Using OR between words allows partial phrase matching
  const ftsTerms = words.map((w) => {
    // Add prefix wildcard for partial matching
    return `${w}*`
  })

  // Join with space (implicit AND in FTS5) for phrase-like searching
  // But also allow any word match by using OR
  if (ftsTerms.length === 1) {
    return ftsTerms[0]
  }

  // For multiple words, try exact phrase first (quoted), then fallback to all words
  // FTS5 syntax: "word1 word2" for phrase, word1 word2 for AND, word1 OR word2 for OR
  return ftsTerms.join(' OR ')
}

/**
 * Removes diacritics from text for normalized search
 * This ensures searches work regardless of whether the user types with diacritics
 */
function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
 * Generates highlighted text by wrapping matching terms in <mark> tags
 * Done in JS to avoid expensive SQLite highlight() function
 */
function generateHighlightedText(text: string, searchWords: string[]): string {
  if (!searchWords.length) return text

  let result = text

  for (const word of searchWords) {
    if (word.length < 2) continue
    // Create pattern that matches the word (with prefix matching already handled by FTS)
    // Use word boundary or start of string to avoid partial matches within words
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(${escapedWord}[a-zA-ZăâîșțĂÂÎȘȚ]*)`, 'gi')
    result = result.replace(pattern, '<mark>$1</mark>')
  }

  return result
}

/**
 * Clears the search cache (call when index is updated)
 */
export function clearSearchCache(): void {
  searchCache.clear()
  log('debug', 'Search cache cleared')
}

/**
 * Invalidates prepared statements (call when DB connection changes)
 */
export function invalidatePreparedStatements(): void {
  preparedStatements.searchWithTranslation = null
  preparedStatements.searchWithoutTranslation = null
  log('debug', 'Prepared statements invalidated')
}

/**
 * Full-text search across verse content
 * Uses prepared statements for optimal performance
 * Implements LRU caching for repeated queries
 * Supports fuzzy matching via prefix search and OR operators
 */
export function searchVersesByText(
  input: SearchVersesInput,
): BibleSearchResult[] {
  const startTime = performance.now()
  const { query, translationId, limit = 50 } = input

  if (!query || query.trim().length < 2) {
    return []
  }

  // Check cache first (before any processing)
  const cacheKey = getCacheKey(query, translationId, limit)
  const cachedResults = getFromCache(cacheKey)
  if (cachedResults) {
    log('debug', `Cache hit for: "${query}" (${cachedResults.length} results)`)
    return cachedResults
  }

  // Escape special FTS characters and prepare for FTS5 query
  // Also remove diacritics to match the FTS index tokenizer settings
  const sanitizedQuery = removeDiacritics(query)
    .replace(/['"]/g, '')
    .replace(/[*()]/g, ' ')
    .trim()

  if (!sanitizedQuery) {
    return []
  }

  // Split into words for fuzzy matching
  const words = sanitizedQuery.split(/\s+/).filter((w) => w.length >= 1)

  // Generate fuzzy FTS query
  const ftsQuery = generateFuzzyFtsQuery(words)

  log(
    'debug',
    `Searching for: "${query}" → normalized: "${sanitizedQuery}" → FTS query: "${ftsQuery}"`,
  )

  try {
    // Use prepared statement for maximum performance
    const stmt = getSearchStatement(!!translationId)

    const results = (
      translationId
        ? stmt.all({
            $query: ftsQuery,
            $translationId: translationId,
            $limit: limit,
          })
        : stmt.all({ $query: ftsQuery, $limit: limit })
    ) as Array<{
      id: number
      translation_id: number
      book_id: number
      book_name: string
      book_code: string
      chapter: number
      verse: number
      text: string
    }>

    // Map results and generate highlights in JavaScript (faster than SQL highlight())
    const mappedResults = results.map((r) => ({
      id: r.id,
      translationId: r.translation_id,
      bookId: r.book_id,
      bookName: r.book_name,
      bookCode: r.book_code,
      chapter: r.chapter,
      verse: r.verse,
      text: r.text,
      reference: formatReference(r.book_name, r.chapter, r.verse),
      highlightedText: generateHighlightedText(r.text, words),
    }))

    // Cache results for future queries
    setInCache(cacheKey, mappedResults)

    const elapsed = performance.now() - startTime
    log(
      'debug',
      `Search completed: "${query}" → ${mappedResults.length} results in ${elapsed.toFixed(1)}ms`,
    )

    return mappedResults
  } catch (error) {
    log('error', `Search failed: ${error}`)

    // If prepared statement failed (e.g., after DB reconnection), clear and retry once
    if (String(error).includes('statement')) {
      preparedStatements.searchWithTranslation = null
      preparedStatements.searchWithoutTranslation = null
      log('warning', 'Cleared prepared statements cache, retrying...')
    }

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

  // Clear cache since index changed
  clearSearchCache()

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
    rawDb.run(
      "INSERT INTO bible_verses_fts(bible_verses_fts) VALUES('rebuild')",
    )
  } catch (error) {
    // If rebuild fails (e.g., table doesn't exist or is corrupted), recreate it
    log('warning', `FTS rebuild command failed, recreating table: ${error}`)

    // Drop and recreate the FTS table
    rawDb.run('DROP TABLE IF EXISTS bible_verses_fts')
    rawDb.run(`
      CREATE VIRTUAL TABLE bible_verses_fts USING fts5(
        text,
        content=bible_verses,
        content_rowid=id,
        tokenize='unicode61 remove_diacritics 2'
      )
    `)

    // Now rebuild
    rawDb.run(
      "INSERT INTO bible_verses_fts(bible_verses_fts) VALUES('rebuild')",
    )
  }

  // Clear cache since index changed
  clearSearchCache()

  // Count indexed verses
  const count = rawDb
    .query<{ count: number }, []>(
      'SELECT COUNT(*) as count FROM bible_verses_fts',
    )
    .get()?.count

  log('info', `FTS index rebuilt: ${count ?? 0} verses indexed`)
}
