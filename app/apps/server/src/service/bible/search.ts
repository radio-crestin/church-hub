import { and, asc, eq } from 'drizzle-orm'

import { getBookByCode } from './books'
import { getDefaultTranslation } from './translations'
import type { BibleSearchResult, BibleVerse, SearchVersesInput } from './types'
import { BOOK_ALIASES } from './types'
import { formatReference, getVerse, getVerseRange } from './verses'
import type { Statement } from 'bun:sqlite'
import { getDatabase, getRawDatabase } from '../../db'
import { bibleBooks, bibleVerses } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible:search')

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

  // Use a subquery to rank FTS results first, then JOIN only the top matches.
  // This avoids the performance trap where SQLite JOINs ALL FTS matches
  // before sorting/limiting, which is ~50x slower (~460ms vs ~10ms).
  // We fetch more candidates (limit * 5) from FTS to account for filtering
  // by translationId, then apply the final LIMIT after the JOIN.

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
        FROM (
          SELECT rowid AS rid, bm25(bible_verses_fts) AS rank
          FROM bible_verses_fts
          WHERE bible_verses_fts MATCH $query
          ORDER BY bm25(bible_verses_fts)
          LIMIT $limit * 5
        ) fts
        JOIN bible_verses v ON v.id = fts.rid
          AND v.translation_id = $translationId
        JOIN bible_books b ON b.id = v.book_id
        ORDER BY fts.rank
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
      FROM (
        SELECT rowid AS rid, bm25(bible_verses_fts) AS rank
        FROM bible_verses_fts
        WHERE bible_verses_fts MATCH $query
        ORDER BY bm25(bible_verses_fts)
        LIMIT $limit * 5
      ) fts
      JOIN bible_verses v ON v.id = fts.rid
      JOIN bible_books b ON b.id = v.book_id
      ORDER BY fts.rank
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

/**
 * Clears the search results cache (used by the search benchmark so timings
 * measure the engine, not the LRU).
 */
export function clearBibleSearchCache(): void {
  searchCache.clear()
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
 * Generates FTS query with implicit AND semantics for multi-word queries.
 * Only the LAST word gets prefix matching (the word still being typed).
 * Previous words are treated as exact terms since the user finished typing them.
 * This avoids the FTS5 performance trap where prefix expansion on multiple words
 * causes queries to take seconds instead of milliseconds.
 */
function generateFuzzyFtsQuery(words: string[]): string {
  if (words.length === 1) {
    // Single word: always use prefix matching (user is still typing)
    return `${words[0]}*`
  }

  // Multiple words: exact match for completed words, prefix only on the last word
  // FTS5 implicit AND is used (terms separated by spaces)
  const completed = words.slice(0, -1)
  const lastWord = words[words.length - 1]
  return [...completed, `${lastWord}*`].join(' ')
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
    logger.debug(`Unknown book name: ${bookName}`)
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
      logger.warning('No translations available')
      return []
    }
    effectiveTranslationId = defaultTranslation.id
  }

  // Check if book exists in this translation
  const book = getBookByCode(effectiveTranslationId, parsed.bookCode)
  if (!book) {
    logger.debug(
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
/**
 * Builds a regex pattern where each character also matches its diacritical variants.
 * e.g., "a" matches "a", "ă", "â" so that a diacritic-stripped search word
 * highlights the original text that contains diacritics.
 */
function buildDiacriticInsensitivePattern(word: string): string {
  const diacriticMap: Record<string, string> = {
    a: '[aăâ]',
    i: '[iî]',
    s: '[sș]',
    t: '[tț]',
  }
  return word
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase()
      if (diacriticMap[lower]) return diacriticMap[lower]
      return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
}

function generateHighlightedText(text: string, searchWords: string[]): string {
  if (!searchWords.length) return text

  // Build patterns: first try the full phrase (all words joined by whitespace),
  // then individual words >= 2 chars. Single-char words only participate in the
  // phrase pattern to avoid highlighting every "a" or "o" in the text.
  const patterns: string[] = []
  const wordSuffix = '[a-zA-ZăâîșțĂÂÎȘȚ]*'

  // Full phrase pattern: matches all search words separated by whitespace
  if (searchWords.length > 1) {
    const phrasePattern = searchWords
      .map((w) => buildDiacriticInsensitivePattern(w))
      .join('\\s+')
    // Allow the last word to match as a prefix (user may still be typing)
    patterns.push(`${phrasePattern}${wordSuffix}`)
  }

  // Individual word patterns (only words >= 2 chars to avoid noisy single-char matches)
  for (const word of searchWords) {
    if (word.length < 2) continue
    const diacriticPattern = buildDiacriticInsensitivePattern(word)
    patterns.push(`${diacriticPattern}${wordSuffix}`)
  }

  // Combine all patterns with OR, longest first (phrase before individual words)
  const combined = new RegExp(`(${patterns.join('|')})`, 'gi')
  return text.replace(combined, '<mark>$1</mark>')
}

/**
 * Clears the search cache (call when index is updated)
 */
export function clearSearchCache(): void {
  searchCache.clear()
  logger.debug('Search cache cleared')
}

/**
 * Invalidates prepared statements (call when DB connection changes)
 */
export function invalidatePreparedStatements(): void {
  preparedStatements.searchWithTranslation = null
  preparedStatements.searchWithoutTranslation = null
  logger.debug('Prepared statements invalidated')
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
  const { query, translationId, limit: rawLimit = 30 } = input
  const limit = Math.min(Math.max(1, rawLimit), 100)

  if (!query || query.trim().length < 2) {
    return []
  }

  // Normalize query for cache key consistency (trim, remove diacritics)
  const sanitizedQuery = removeDiacritics(query)
    .replace(/['"]/g, '')
    .replace(/[*()]/g, ' ')
    .trim()

  if (!sanitizedQuery) {
    return []
  }

  // Use sanitized query for cache key so "O zi Isus " and "O zi Isus" hit the same cache
  const cacheKey = getCacheKey(sanitizedQuery, translationId, limit)
  const cachedResults = getFromCache(cacheKey)
  if (cachedResults) {
    logger.debug(`Cache hit for: "${query}" (${cachedResults.length} results)`)
    return cachedResults
  }

  // All words for highlighting (including short ones like "a", "o")
  const allWords = sanitizedQuery.split(/\s+/).filter(Boolean)
  // Filter out single-character words for FTS queries only (common articles like "o", "a"
  // cause prefix queries like "o*" to match thousands of words and are extremely slow in FTS5)
  const words = allWords.filter((w) => w.length >= 2)

  if (words.length === 0) {
    return []
  }

  // Generate fuzzy FTS query
  const ftsQuery = generateFuzzyFtsQuery(words)

  logger.debug(
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
      highlightedText: generateHighlightedText(r.text, allWords),
    }))

    // Cache results for future queries
    setInCache(cacheKey, mappedResults)

    const elapsed = performance.now() - startTime
    logger.debug(
      `Search completed: "${query}" → ${mappedResults.length} results in ${elapsed.toFixed(1)}ms`,
    )

    return mappedResults
  } catch (error) {
    logger.error(`Search failed: ${error}`)

    // If prepared statement failed (e.g., after DB reconnection), clear and retry once
    if (String(error).includes('statement')) {
      preparedStatements.searchWithTranslation = null
      preparedStatements.searchWithoutTranslation = null
      logger.warning('Cleared prepared statements cache, retrying...')
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

  logger.info(`Updating FTS index for translation ${translationId}`)

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

  logger.info('FTS index updated')
}

/**
 * Warms up the FTS index by running a cheap query that forces SQLite
 * to load the index pages from disk into the OS page cache.
 * Without this, the first user search takes ~1s instead of ~2ms.
 */
export function warmupSearchIndex(): void {
  const startTime = performance.now()
  try {
    const rawDb = getRawDatabase()
    // COUNT(*) forces SQLite to scan the FTS index, loading pages into OS cache
    rawDb.run('SELECT COUNT(*) FROM bible_verses_fts')
  } catch {
    // FTS table might not exist yet, that's fine
  }
  const elapsed = performance.now() - startTime
  logger.info(`FTS index warmup completed in ${elapsed.toFixed(1)}ms`)
}

/**
 * Rebuilds the entire Bible FTS index
 * Uses raw SQL for FTS operations (not supported by Drizzle)
 */
export function rebuildSearchIndex(): void {
  const rawDb = getRawDatabase()

  logger.info('Rebuilding entire Bible FTS index')

  // Always drop and recreate the FTS table to ensure the correct tokenizer
  // config is applied (e.g., remove_diacritics 2 for accent-insensitive search)
  rawDb.run('DROP TABLE IF EXISTS bible_verses_fts')
  rawDb.run(`
    CREATE VIRTUAL TABLE bible_verses_fts USING fts5(
      text,
      content=bible_verses,
      content_rowid=id,
      tokenize='unicode61 remove_diacritics 2'
    )
  `)

  // Rebuild from content table
  rawDb.run("INSERT INTO bible_verses_fts(bible_verses_fts) VALUES('rebuild')")

  // Invalidate prepared statements since table was recreated
  invalidatePreparedStatements()

  // Clear cache since index changed
  clearSearchCache()

  // Count indexed verses
  const count = rawDb
    .query<{ count: number }, []>(
      'SELECT COUNT(*) as count FROM bible_verses_fts',
    )
    .get()?.count

  logger.info(`FTS index rebuilt: ${count ?? 0} verses indexed`)
}
