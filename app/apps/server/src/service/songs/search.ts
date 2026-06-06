import { getHiddenCategoryIds } from './categories'
import type { SongSearchResult } from './types'
import { getRawDatabase } from '../../db'
import { getSetting } from '../settings'

/**
 * Synonym group interface matching client-side structure
 */
interface SynonymGroup {
  id: string
  primary: string
  synonyms: string[]
}

/**
 * Synonyms configuration stored in app_settings
 */
interface SynonymsConfig {
  groups: SynonymGroup[]
}

/**
 * In-memory cache for synonyms to avoid DB hits on every search
 */
let synonymsCache: Map<string, string[]> | null = null
let synonymsCacheTimestamp = 0
const SYNONYMS_CACHE_TTL = 60000 // 1 minute cache TTL

// ============================================================================
// LRU Cache for Search Results
// ============================================================================

interface SearchCacheEntry {
  results: SongSearchResult[]
  timestamp: number
}

const SEARCH_CACHE_MAX_SIZE = 100
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

const searchResultsCache = new Map<string, SearchCacheEntry>()

function getSearchCacheKey(
  query: string,
  categoryIds: number[] | undefined,
  filters?: {
    presentedOnly?: boolean
    inSchedulesOnly?: boolean
    hasKeyLine?: boolean
  },
): string {
  const categoryKey = categoryIds?.sort().join(',') ?? 'all'
  const filterKey = [
    filters?.presentedOnly ? 'p' : '',
    filters?.inSchedulesOnly ? 's' : '',
    filters?.hasKeyLine ? 'k' : '',
  ]
    .filter(Boolean)
    .join('')
  return `${query.toLowerCase().trim()}:${categoryKey}:${filterKey}`
}

function getFromSearchCache(key: string): SongSearchResult[] | null {
  const entry = searchResultsCache.get(key)
  if (!entry) return null

  // Check if expired
  if (Date.now() - entry.timestamp > SEARCH_CACHE_TTL_MS) {
    searchResultsCache.delete(key)
    return null
  }

  // Move to end (most recently used) by re-inserting
  searchResultsCache.delete(key)
  searchResultsCache.set(key, entry)

  return entry.results
}

function setInSearchCache(key: string, results: SongSearchResult[]): void {
  // Evict oldest entries if cache is full
  if (searchResultsCache.size >= SEARCH_CACHE_MAX_SIZE) {
    const firstKey = searchResultsCache.keys().next().value
    if (firstKey) searchResultsCache.delete(firstKey)
  }

  searchResultsCache.set(key, {
    results,
    timestamp: Date.now(),
  })
}

/**
 * Clears the search results cache (call when index is updated)
 */
export function clearSearchCache(): void {
  searchResultsCache.clear()
  logger.debug('Search cache cleared')
}

/**
 * Loads and caches synonyms from the database
 * Returns a Map where each term (primary and synonyms) maps to all related terms
 */
function loadSynonyms(): Map<string, string[]> {
  const now = Date.now()

  // Return cached if still valid
  if (synonymsCache && now - synonymsCacheTimestamp < SYNONYMS_CACHE_TTL) {
    return synonymsCache
  }

  logger.debug('Loading synonyms from database')

  const setting = getSetting('app_settings', 'search_synonyms')
  const synonymMap = new Map<string, string[]>()

  if (!setting) {
    logger.debug('No synonyms configured')
    synonymsCache = synonymMap
    synonymsCacheTimestamp = now
    return synonymMap
  }

  try {
    const config = JSON.parse(setting.value) as SynonymsConfig

    for (const group of config.groups) {
      // All terms in the group (primary + synonyms)
      const allTerms = [
        group.primary.toLowerCase(),
        ...group.synonyms.map((s) => s.toLowerCase()),
      ]

      // Each term maps to all other terms in the group
      for (const term of allTerms) {
        const otherTerms = allTerms.filter((t) => t !== term)
        const existing = synonymMap.get(term) || []
        synonymMap.set(term, [...new Set([...existing, ...otherTerms])])
      }
    }

    logger.debug(`Loaded ${config.groups.length} synonym groups`)
  } catch (error) {
    logger.error(`Failed to parse synonyms config: ${error}`)
  }

  synonymsCache = synonymMap
  synonymsCacheTimestamp = now
  return synonymMap
}

/**
 * Expands search terms with their synonyms
 * Example: ["cristos"] -> ["cristos", "hristos"]
 */
function expandTermsWithSynonyms(terms: string[]): string[] {
  const synonymMap = loadSynonyms()
  const expandedTerms = new Set<string>(terms)

  for (const term of terms) {
    const synonyms = synonymMap.get(term.toLowerCase())
    if (synonyms) {
      for (const synonym of synonyms) {
        expandedTerms.add(synonym)
      }
    }
  }

  const result = Array.from(expandedTerms)
  if (result.length > terms.length) {
    logger.debug(`Expanded terms: ${terms.join(', ')} -> ${result.join(', ')}`)
  }

  return result
}

import { createLogger } from '../../utils/logger'

const logger = createLogger('song-search')

/**
 * Normalizes text by removing diacritics (accents)
 * e.g., "în" -> "in", "ă" -> "a", "ș" -> "s"
 */
function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normalizes text for FTS indexing:
 * - Replaces hyphens with spaces (so "să-nfăptuiesc" becomes "să nfăptuiesc")
 * - Expands Romanian contractions (n- prefix) for better searchability
 * - Diacritics are handled by the FTS5 tokenizer (remove_diacritics 2)
 *
 * Romanian linguistic patterns handled:
 * - "să-nfăptuiesc" → "sa nfaptuiesc faptuiesc" (n- is contraction of "în")
 * - "n-am" → "n am am" (expands contraction)
 * - "s-a" → "s a" (reflexive pronoun contraction)
 */
export function normalizeForIndex(text: string): string {
  let normalized = removeDiacritics(text)
    .replace(/<[^>]+>/g, ' ') // Strip HTML tags before normalization
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Replace ALL punctuation (commas, hyphens, periods, etc.) with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()

  // Expand Romanian n- contractions: words starting with "n" followed by consonant
  // are often contractions of "în" + word (e.g., "nfaptuiesc" = "infaptuiesc" → also index "faptuiesc")
  const words = normalized.split(' ')
  const expandedWords: string[] = []

  for (const word of words) {
    expandedWords.push(word)
    if (
      word.length > 2 &&
      word[0].toLowerCase() === 'n' &&
      !/^n[aeiou]/i.test(word)
    ) {
      expandedWords.push(word.substring(1))
    }
  }

  // Single-character tokens stay in the index. They are linguistically
  // meaningful — the Romanian clitic contractions split into them at
  // tokenization ("m-a" → "m a") and a user typing the exact title needs
  // those tokens to land an exact phrase match in FTS. Per-term scoring
  // protects itself with ordered indexOf in calculateTitleScoreNormalized.
  return expandedWords.join(' ')
}

/**
 * Updates the FTS index for a specific song (both standard and trigram)
 */
export function updateSearchIndex(songId: number): void {
  try {
    logger.debug(`Updating search index for song: ${songId}`)

    const db = getRawDatabase()

    // Get song title and category name
    const songQuery = db.query(`
      SELECT s.title, sc.name as category_name
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE s.id = ?
    `)
    const song = songQuery.get(songId) as {
      title: string
      category_name: string | null
    } | null

    if (!song) {
      logger.debug(`Song not found for indexing: ${songId}`)
      return
    }

    // Get all slide content for this song
    const slidesQuery = db.query(
      'SELECT content FROM song_slides WHERE song_id = ? ORDER BY sort_order ASC',
    )
    const slides = slidesQuery.all(songId) as { content: string }[]
    const combinedContent = slides.map((s) => s.content).join(' ')

    // Normalize text for indexing (replace hyphens with spaces for better matching)
    const normalizedTitle = normalizeForIndex(song.title)
    const normalizedCategory = normalizeForIndex(song.category_name ?? '')
    const normalizedContent = normalizeForIndex(combinedContent)

    // Update standard FTS index
    db.query('DELETE FROM songs_fts WHERE song_id = ?').run(songId)
    db.query(`
      INSERT INTO songs_fts (song_id, title, category_name, content)
      VALUES (?, ?, ?, ?)
    `).run(songId, normalizedTitle, normalizedCategory, normalizedContent)

    // Update trigram FTS index for fuzzy matching
    db.query('DELETE FROM songs_fts_trigram WHERE song_id = ?').run(songId)
    db.query(`
      INSERT INTO songs_fts_trigram (song_id, title, content)
      VALUES (?, ?, ?)
    `).run(songId, normalizedTitle, normalizedContent)

    logger.debug(`Search index updated for song: ${songId}`)
  } catch (error) {
    logger.error(`Failed to update search index: ${error}`)
  }
}

/**
 * Removes a song from the FTS index (both standard and trigram)
 */
export function removeFromSearchIndex(songId: number): void {
  try {
    logger.debug(`Removing song from search index: ${songId}`)

    const db = getRawDatabase()
    db.query('DELETE FROM songs_fts WHERE song_id = ?').run(songId)
    db.query('DELETE FROM songs_fts_trigram WHERE song_id = ?').run(songId)

    logger.debug(`Song removed from search index: ${songId}`)
  } catch (error) {
    logger.error(`Failed to remove from search index: ${error}`)
  }
}

/**
 * Updates the FTS index for all songs in a category
 * Called when a category name is updated
 */
export function updateSearchIndexByCategory(categoryId: number): void {
  try {
    logger.debug(`Updating search index for category: ${categoryId}`)

    const db = getRawDatabase()
    const songsQuery = db.query('SELECT id FROM songs WHERE category_id = ?')
    const songs = songsQuery.all(categoryId) as { id: number }[]

    for (const song of songs) {
      updateSearchIndex(song.id)
    }

    logger.debug(`Updated ${songs.length} songs for category: ${categoryId}`)
  } catch (error) {
    logger.error(`Failed to update search index for category: ${error}`)
  }
}

/**
 * Batch updates the FTS index for multiple songs in a single transaction
 * Uses JavaScript normalization to properly expand Romanian contractions
 */
export function batchUpdateSearchIndex(songIds: number[]): void {
  if (songIds.length === 0) return

  try {
    const totalStart = performance.now()
    logger.info(`Batch updating search index for ${songIds.length} songs`)

    const db = getRawDatabase()

    // Build placeholders for IN clause
    const placeholders = songIds.map(() => '?').join(',')

    // Fetch songs data
    const songs = db
      .query(
        `
      SELECT
        s.id,
        s.title,
        COALESCE(sc.name, '') as category_name,
        COALESCE(GROUP_CONCAT(ss.content, ' '), '') as content
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      LEFT JOIN (
        SELECT song_id, content FROM song_slides ORDER BY sort_order
      ) ss ON ss.song_id = s.id
      WHERE s.id IN (${placeholders})
      GROUP BY s.id
    `,
      )
      .all(...songIds) as Array<{
      id: number
      title: string
      category_name: string
      content: string
    }>

    db.run('BEGIN TRANSACTION')

    try {
      // Delete existing FTS entries for these songs
      const deleteStart = performance.now()
      db.query(`DELETE FROM songs_fts WHERE song_id IN (${placeholders})`).run(
        ...songIds,
      )
      db.query(
        `DELETE FROM songs_fts_trigram WHERE song_id IN (${placeholders})`,
      ).run(...songIds)
      const deleteTime = performance.now() - deleteStart

      // Prepare insert statements
      const ftsInsert = db.prepare(`
        INSERT INTO songs_fts (song_id, title, category_name, content)
        VALUES (?, ?, ?, ?)
      `)

      const trigramInsert = db.prepare(`
        INSERT INTO songs_fts_trigram (song_id, title, content)
        VALUES (?, ?, ?)
      `)

      // Insert each song with normalized content
      const ftsStart = performance.now()
      for (const song of songs) {
        const normalizedTitle = normalizeForIndex(song.title)
        const normalizedCategory = normalizeForIndex(song.category_name)
        const normalizedContent = normalizeForIndex(song.content)

        ftsInsert.run(
          song.id,
          normalizedTitle,
          normalizedCategory,
          normalizedContent,
        )

        trigramInsert.run(song.id, normalizedTitle, normalizedContent)
      }
      const ftsTime = performance.now() - ftsStart

      db.run('COMMIT')
      const totalTime = performance.now() - totalStart

      // Clear the search cache since index changed
      clearSearchCache()

      logger.info(
        `[PERF] Search index update: ${totalTime.toFixed(2)}ms | Delete: ${deleteTime.toFixed(0)}ms | FTS: ${ftsTime.toFixed(0)}ms`,
      )
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
  } catch (error) {
    logger.error(`Failed to batch update search index: ${error}`)
  }
}

/**
 * Warms up the songs FTS index by running a cheap query to load index pages into OS page cache.
 */
export function warmupSearchIndex(): void {
  const startTime = performance.now()
  try {
    const rawDb = getRawDatabase()
    rawDb.run("SELECT rowid FROM songs_fts WHERE songs_fts MATCH 'a*' LIMIT 1")
    rawDb.run(
      "SELECT rowid FROM songs_fts_trigram WHERE songs_fts_trigram MATCH 'aaa' LIMIT 1",
    )
  } catch {
    // FTS tables might not exist yet
  }
  const elapsed = performance.now() - startTime
  logger.info(`FTS index warmup completed in ${elapsed.toFixed(1)}ms`)
}

/**
 * Rebuilds the entire search index (both standard and trigram)
 * Uses JavaScript normalization to properly expand Romanian contractions
 * and handle hyphenated words for better searchability
 */
export function rebuildSearchIndex(): void {
  try {
    logger.info('Rebuilding search index...')

    const db = getRawDatabase()

    // Fetch all songs with their content
    const songs = db
      .query(
        `
      SELECT
        s.id,
        s.title,
        COALESCE(sc.name, '') as category_name,
        COALESCE(GROUP_CONCAT(ss.content, ' '), '') as content
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      LEFT JOIN (
        SELECT song_id, content FROM song_slides ORDER BY sort_order
      ) ss ON ss.song_id = s.id
      GROUP BY s.id
    `,
      )
      .all() as Array<{
      id: number
      title: string
      category_name: string
      content: string
    }>

    logger.info(`Found ${songs.length} songs to index`)

    // Use a transaction for atomicity
    db.run('BEGIN TRANSACTION')

    try {
      // Clear existing indexes
      db.run('DELETE FROM songs_fts')
      db.run('DELETE FROM songs_fts_trigram')

      // Prepare insert statements
      const ftsInsert = db.prepare(`
        INSERT INTO songs_fts (song_id, title, category_name, content)
        VALUES (?, ?, ?, ?)
      `)

      const trigramInsert = db.prepare(`
        INSERT INTO songs_fts_trigram (song_id, title, content)
        VALUES (?, ?, ?)
      `)

      // Insert each song with normalized content
      for (const song of songs) {
        const normalizedTitle = normalizeForIndex(song.title)
        const normalizedCategory = normalizeForIndex(song.category_name)
        const normalizedContent = normalizeForIndex(song.content)

        ftsInsert.run(
          song.id,
          normalizedTitle,
          normalizedCategory,
          normalizedContent,
        )

        trigramInsert.run(song.id, normalizedTitle, normalizedContent)
      }

      db.run('COMMIT')

      // Clear the search cache since index changed
      clearSearchCache()

      logger.info(`Search index rebuilt: ${songs.length} songs indexed`)
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
  } catch (error) {
    logger.error(`Failed to rebuild search index: ${error}`)
  }
}

/**
 * Extracts and sanitizes search terms from query text.
 *
 * Strips a single leading hymn-number prefix ("1.", "265 -", "34 ") so
 * that users who type "1. Cand Isus Hristos m-a mantuit" still hit the
 * canonical title "Cand Isus Hristos m-a mantuit". Single-letter tokens
 * inside the rest of the query (Romanian clitic contractions m / a /
 * s / n that come from splitting "m-a", "s-a", "n-am") are preserved —
 * they carry phrase signal in FTS and are handled defensively in
 * downstream scoring (ordered indexOf, broad-OR exclusion).
 */
export function extractSearchTerms(queryText: string): string[] {
  // Strip leading hymn-number-style prefix: optional digits, an optional
  // "." or "-", and trailing whitespace. Only at the START of the input
  // so internal numbers (e.g. song lyrics containing dates) survive.
  const dehymned = queryText.replace(/^\s*\d+[.\-]?\s+/, '')

  const sanitized = removeDiacritics(dehymned)
    .replace(/['"]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Replace ALL non-letter, non-number, non-space chars with space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  const terms = sanitized.split(/\s+/).filter((t) => t.length > 0)

  // Deduplicate terms (e.g. "Isus,Isus" → ["isus", "isus"] → ["isus"])
  return [...new Set(terms)]
}

/**
 * Searches for a song by hymn number (e.g. "#034", "#34", "034", "34")
 * Returns results directly from DB lookup (pre-phase, before FTS)
 */
function searchByHymnNumber(
  rawQuery: string,
  db: ReturnType<typeof getRawDatabase>,
  extraFilter: string,
  categoryParams: number[],
): Array<{
  id: number
  title: string
  category_id: number | null
  category_name: string | null
  category_priority: number
  presentation_count: number
  key_line: string | null
  hymn_number: string | null
}> | null {
  // Match queries like "#034", "#34", "034", "34" — purely numeric with optional # prefix
  const match = rawQuery.trim().match(/^#?(\d+)$/)
  if (!match) return null

  const numericPart = match[1]
  // Strip leading zeros for a normalized comparison
  const numericValue = Number.parseInt(numericPart, 10).toString()

  logger.debug(
    `Hymn number pre-phase lookup for: "${rawQuery}" → ${numericValue}`,
  )

  const rows = db
    .query(
      `
      SELECT
        s.id,
        s.title,
        s.category_id,
        sc.name as category_name,
        COALESCE(sc.priority, 1) as category_priority,
        s.presentation_count,
        s.key_line,
        s.hymn_number
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE (
        s.hymn_number = ?
        OR s.hymn_number = ?
        OR CAST(CAST(s.hymn_number AS INTEGER) AS TEXT) = ?
        OR (
          s.title GLOB '[0-9]*'
          AND CAST(SUBSTR(s.title, 1,
            CASE WHEN INSTR(s.title, ' ') > 0
              THEN INSTR(s.title, ' ') - 1
              ELSE LENGTH(s.title)
            END
          ) AS INTEGER) = CAST(? AS INTEGER)
        )
      )
      ${extraFilter ? `AND ${extraFilter.replace(/^AND /, '')}` : ''}
      LIMIT 20
    `,
    )
    .all(
      numericPart,
      `#${numericPart}`,
      numericValue,
      numericValue,
      ...categoryParams,
    ) as Array<{
    id: number
    title: string
    category_id: number | null
    category_name: string | null
    category_priority: number
    presentation_count: number
    key_line: string | null
    hymn_number: string | null
  }>

  return rows.length > 0 ? rows : null
}

/**
 * Checks which terms exist in the corpus.
 * Uses a single FTS query with OR to check all terms at once.
 * All terms that match at least one document are considered valid.
 */
export function getValidTerms(terms: string[]): { validTerms: string[] } {
  // All terms are valid if they can be part of an FTS query
  // The FTS engine handles non-matching terms gracefully
  const validTerms = terms.filter(
    (t) => t.length > 0 && /^[\p{L}\p{N}]+$/u.test(t),
  )
  return { validTerms }
}

/**
 * Builds a simple FTS5 query optimized for performance
 * Uses OR for broad matching, letting post-processing handle ranking
 *
 * Strategy:
 * 1. Exact phrase match (highest BM25 boost)
 * 2. NEAR query for proximity matching
 * 3. OR with prefix for each term (broad candidate search)
 *
 * Single-character terms are filtered out to reduce noise
 * (e.g., "m-a mantuit" becomes ["a", "mantuit"] → only ["mantuit"] is used for FTS)
 */
export function buildSearchQuery(
  queryText: string,
  /**
   * Original (pre-synonym-expansion) terms used to build a tight
   * `title:"…"` clause. When `queryText` carries synonym-expanded
   * terms (e.g. `cristos` appended because the user typed `hristos`),
   * the title-restricted phrase must NOT include the synonyms,
   * otherwise it never matches any indexed title. Defaults to the
   * extracted terms of `queryText` for back-compat with callers that
   * don't expand.
   */
  originalTerms?: string[],
): string {
  const effectiveTerms = extractSearchTerms(queryText)

  if (effectiveTerms.length === 0) return ''

  if (effectiveTerms.length === 1) {
    return `"${effectiveTerms[0]}"*`
  }

  // Tiered query. Order matters because BM25 sums score contributions
  // across all matched sub-clauses, so the most-specific tier first
  // gives true title matches a decisive boost.
  //
  // - title:"<original phrase>" : exact title match (incl. clitic
  //     single-letter tokens like "m a", so "Cand Isus Hristos m-a
  //     mantuit" indexes/matches identically). Built from the user's
  //     ORIGINAL terms only — synonyms (e.g. cristos) must not appear
  //     in the title clause or it never matches a real title.
  // - "<expanded phrase>" : exact phrase in any column, synonym-aware.
  // - NEAR(expanded, 10) : proximity fallback.
  // - prefix OR (multi-char terms only) : broad recall. Single-char
  //     prefixes like "a"* match every word starting with "a" — they
  //     are excluded here to avoid drowning specific matches in noise.
  const titlePhraseTerms = originalTerms ?? effectiveTerms
  const broadOrTerms = effectiveTerms.filter((t) => t.length > 1)

  const clauses: string[] = []
  if (titlePhraseTerms.length > 1) {
    clauses.push(`(title:"${titlePhraseTerms.join(' ')}")`)
  }
  clauses.push(`("${effectiveTerms.join(' ')}")`)
  clauses.push(`(NEAR(${effectiveTerms.map((t) => `"${t}"`).join(' ')}, 10))`)
  if (broadOrTerms.length > 0) {
    clauses.push(`(${broadOrTerms.map((t) => `"${t}"*`).join(' OR ')})`)
  }

  return clauses.join(' OR ')
}

/**
 * Title scoring for pre-normalized (diacritics-free, lowercase) text.
 * Skips redundant removeDiacritics calls.
 */
export function calculateTitleScoreNormalized(
  normalizedTitle: string,
  queryTerms: string[],
): number {
  if (!normalizedTitle || queryTerms.length === 0) return 0

  const title = normalizedTitle.toLowerCase()
  const exactPhrase = queryTerms.join(' ')

  if (title.startsWith(exactPhrase)) return 100
  if (title.includes(exactPhrase)) return 95

  // Per-term matching with TWO passes:
  //   1. inOrderCount  — terms found in the same order they appear in the
  //      query, by searching from lastMatchPos + 1 each step. Single-letter
  //      tokens (Romanian clitics "m", "a", "s", "n" that come from
  //      splitting "m-a", "s-a", "n-am") that happen to also appear earlier
  //      inside another word ("a" in "cAnd") no longer poison the order
  //      detection — the ordered scan finds the LATER occurrence that
  //      actually belongs to the clitic position in the title.
  //   2. matchedCount  — terms that appear anywhere in the title at all.
  //      Used to reward full coverage even when one term is out of order.
  let matchedCount = 0
  let inOrderCount = 0
  let lastEnd = -1
  for (const term of queryTerms) {
    if (title.includes(term)) matchedCount++
    const orderedPos = title.indexOf(term, lastEnd + 1)
    if (orderedPos !== -1) {
      inOrderCount++
      lastEnd = orderedPos + term.length - 1
    }
  }

  if (matchedCount === 0) return 0

  // Reward proportional coverage of MEANINGFUL terms — single-character
  // tokens contribute when matched but never penalise when missing, so a
  // stray noise char in the query (e.g. user typed "Isus a inviat",
  // tokens ["isus","a","inviat"]) does not drag the percentage down on a
  // title that happens to lack the "a".
  const meaningfulQueryTerms = queryTerms.filter((t) => t.length > 1)
  const meaningfulMatched = meaningfulQueryTerms.filter((t) =>
    title.includes(t),
  ).length
  const denom = meaningfulQueryTerms.length || queryTerms.length
  const matchPercentage = meaningfulMatched / denom

  const orderBonus = inOrderCount === matchedCount ? 0.2 : 0
  const allMatchedBonus =
    meaningfulMatched === meaningfulQueryTerms.length &&
    meaningfulQueryTerms.length > 0
      ? 0.2
      : 0

  return Math.round(
    matchPercentage * 54 + allMatchedBonus * 100 + orderBonus * 100,
  )
}

/**
 * Optimized content scoring for pre-normalized (diacritics-free) text.
 * Skips redundant removeDiacritics calls.
 */
export function calculateBestPhraseScoreNormalized(
  normalizedContent: string,
  queryTerms: string[],
): number {
  if (!normalizedContent || queryTerms.length === 0) return 0

  const content = normalizedContent.toLowerCase()
  const exactPhrase = queryTerms.join(' ')
  if (content.includes(exactPhrase)) return 100

  const termPositions: Map<number, number[]> = new Map()
  for (let i = 0; i < queryTerms.length; i++) {
    const positions: number[] = []
    let pos = 0
    while ((pos = content.indexOf(queryTerms[i], pos)) !== -1) {
      positions.push(pos)
      pos++
    }
    if (positions.length > 0) termPositions.set(i, positions)
  }

  if (termPositions.size === 0) return 0
  if (termPositions.size === 1) return Math.round((1 / queryTerms.length) * 50)

  let bestScore = 0
  const CLUSTER_RADIUS = 150

  for (const [startTermIdx, startPositions] of termPositions) {
    for (const anchorPos of startPositions) {
      const termsInCluster = new Set<number>([startTermIdx])
      let clusterStart = anchorPos
      let clusterEnd = anchorPos + queryTerms[startTermIdx].length

      for (const [termIdx, positions] of termPositions) {
        if (termIdx === startTermIdx) continue
        let closestPos = -1
        let closestDist = Number.POSITIVE_INFINITY
        for (const pos of positions) {
          const d = Math.min(
            Math.abs(pos - clusterStart),
            Math.abs(pos - clusterEnd),
          )
          if (d < closestDist && d <= CLUSTER_RADIUS) {
            closestDist = d
            closestPos = pos
          }
        }
        if (closestPos !== -1) {
          termsInCluster.add(termIdx)
          clusterStart = Math.min(clusterStart, closestPos)
          clusterEnd = Math.max(
            clusterEnd,
            closestPos + queryTerms[termIdx].length,
          )
        }
      }

      const matchRatio = termsInCluster.size / queryTerms.length
      const clusterSpan = clusterEnd - clusterStart

      let inOrder = true
      let lastPos = -1
      for (let i = 0; i < queryTerms.length; i++) {
        if (!termsInCluster.has(i)) continue
        const positions = termPositions.get(i) || []
        const posInCluster = positions.find(
          (p) => p >= clusterStart && p <= clusterEnd,
        )
        if (posInCluster !== undefined) {
          if (posInCluster < lastPos) {
            inOrder = false
            break
          }
          lastPos = posInCluster
        }
      }

      const baseScore = matchRatio * 50
      const idealSpan = termsInCluster.size * 10
      const proximityScore =
        termsInCluster.size > 1
          ? Math.max(0, 30 * (1 - Math.min(1, (clusterSpan - idealSpan) / 200)))
          : 0
      const orderScore = inOrder ? 20 : 0
      bestScore = Math.max(bestScore, baseScore + proximityScore + orderScore)
    }
  }

  return Math.round(bestScore)
}

/**
 * Extracts fuzzy search substrings from a term
 * For "Hristos", extracts substrings that would also match "Cristos"
 * Uses middle portion of words for better fuzzy matching
 * Minimum length 4 to avoid false positives
 */
function extractFuzzySubstrings(term: string): string[] {
  if (term.length < 5) return []

  const substrings: string[] = []

  // Extract middle portions (skip first and last char for fuzzy matching)
  // "Hristos" -> "risto", "isto"
  // "Cristos" -> "risto", "isto"
  // Common matches: "risto", "isto"
  // Minimum length 4 to avoid false positives like "ist" matching "Linistit"
  for (let len = Math.min(5, term.length - 1); len >= 4; len--) {
    for (let start = 1; start <= term.length - len; start++) {
      const sub = term.substring(start, start + len)
      if (sub.length >= 4 && !substrings.includes(sub)) {
        substrings.push(sub)
      }
    }
  }

  return substrings.slice(0, 3) // Limit to top 3 substrings per term
}

/**
 * Finds the word containing a fuzzy substring match
 * Returns the full word that contains the matching substring
 */
function findFuzzyMatchWord(
  content: string,
  term: string,
): { word: string; index: number } | null {
  if (term.length < 5) return null

  const words = content.match(/[\p{L}\p{N}]+/gu) || []

  for (let len = Math.min(5, term.length - 1); len >= 4; len--) {
    for (let start = 1; start <= term.length - len; start++) {
      const sub = term.substring(start, start + len).toLowerCase()
      for (const word of words) {
        if (word.toLowerCase().includes(sub)) {
          const index = content.toLowerCase().indexOf(word.toLowerCase())
          return { word, index }
        }
      }
    }
  }

  return null
}

/**
 * Builds a regex pattern where each character also matches its diacritical variants.
 * e.g., "a" matches "a", "ă", "â" so that a diacritic-stripped search word
 * highlights the original text that contains diacritics.
 */
function buildDiacriticInsensitivePattern(word: string): string {
  // Romanian s and t exist in two Unicode forms: the canonical comma-below
  // (ș U+0219, ț U+021B) and the older cedilla (ş U+015F, ţ U+0163). Both
  // are sprinkled through real texts, so the pattern must accept either
  // when highlighting a diacritic-stripped search token.
  const diacriticMap: Record<string, string> = {
    a: '[aăâ]',
    i: '[iî]',
    s: '[sșş]',
    t: '[tțţ]',
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

/**
 * Highlights search terms in text with diacritic-insensitive matching.
 * Operates on original text (with diacritics) so highlighted output preserves them.
 *
 * When a term match sits inside a hyphenated word (e.g. "am" inside
 * "m-am" or "te-aşteptăm"), the highlight is extended across the whole
 * hyphen-joined chunk. This keeps short Romanian clitic contractions
 * ("m-am", "te-a", "ne-am", "n-a") visually together in the title even
 * though the leading single-letter segment is dropped from the search
 * tokens for ranking purposes.
 */
// Unicode letter class — covers every diacritic variant (incl. cedilla
// forms ş / ţ that show up in Romanian texts alongside the comma-below
// canonical forms ș / ț). The `u` regex flag is required to enable it.
const HL_LETTER = '\\p{L}'

/**
 * Returns true if the gap between two highlight ranges should be swallowed
 * into a single merged range — pure whitespace, a hyphen, or a short
 * Romanian clitic contraction (e.g. "m-a", "te-a", "ne-am", "s-a", "n-am").
 * Plain words like "a" or "este" between two matches stay un-merged so we
 * don't blob everything together.
 */
function isMergeableGap(gap: string): boolean {
  if (gap.length === 0) return true
  const trimmed = gap.trim()
  if (trimmed === '') return true
  return (
    trimmed.length <= 6 && trimmed.includes('-') && /^[\p{L}-]+$/u.test(trimmed)
  )
}

/**
 * Normalises the raw user query into the literal phrase we try to find as a
 * substring of the text being highlighted. Strips the leading hymn-number
 * prefix (mirrors extractSearchTerms), removes diacritics, lowercases and
 * collapses whitespace. Keeps internal hyphens so an incremental typing
 * pass like "Cand Isus Hristos m" → "m-" → "m-a" naturally widens the
 * highlight by one character at a time.
 */
function cleanQueryForHighlight(rawQuery: string): string {
  return removeDiacritics(rawQuery)
    .replace(/^\s*\d+[.\-]?\s+/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * If the cleaned user query appears verbatim inside the (diacritic-stripped,
 * lowercased) text, returns the text with that exact span wrapped in a
 * single <mark>. Returns null otherwise so callers can fall back to per-
 * term highlighting.
 */
function tryExactPhraseHighlight(
  text: string,
  rawQuery: string,
): string | null {
  const cleaned = cleanQueryForHighlight(rawQuery)
  if (cleaned.length === 0) return null
  // removeDiacritics + toLowerCase preserve character count for the
  // Romanian alphabet (NFD splits "ă" into base + combining mark, the
  // combining mark is stripped, length stays the same) so we can map
  // positions 1:1 back to the original text.
  const normText = removeDiacritics(text).toLowerCase()
  const pos = normText.indexOf(cleaned)
  if (pos === -1) return null
  return (
    text.slice(0, pos) +
    `<mark>${text.slice(pos, pos + cleaned.length)}</mark>` +
    text.slice(pos + cleaned.length)
  )
}

export function highlightWithDiacritics(
  text: string,
  searchTerms: string[],
  rawQuery?: string,
): string {
  if (!searchTerms.length && !rawQuery) return text

  // 1. Literal substring match against the user's typed query. This is the
  //    common path while the user types incrementally — "Cand Isus Hristos
  //    m" → "m-" → "m-a" widens the mark one character at a time, exactly
  //    matching what they typed. Title and content highlighters share this
  //    code so the two stay visually in sync.
  if (rawQuery !== undefined && rawQuery.length > 0) {
    const exact = tryExactPhraseHighlight(text, rawQuery)
    if (exact !== null) return exact
  }

  // 2. Fallback: per-term marking when the query is not a literal substring
  //    of the text (different word order, partial phrase, typo). Collects
  //    every term's positions in one pass, then merges adjacent ranges
  //    across whitespace / hyphen / clitic-contraction gaps to avoid a
  //    sea of single-word marks.
  const ranges: Array<{ start: number; end: number }> = []
  for (const term of searchTerms) {
    if (term.length === 0) continue
    const normalized = removeDiacritics(term).toLowerCase()
    const diacriticPattern = buildDiacriticInsensitivePattern(normalized)
    // Short terms (≤ 2 chars) must be word-bounded — otherwise "a" matches
    // inside "cAnd" and "m" matches inside half the corpus. Longer terms
    // can match literally so partial typing like "isu" still highlights
    // the "Isu" in "Isus" without bleeding past it.
    const pattern =
      term.length <= 2
        ? new RegExp(`\\b${diacriticPattern}\\b`, 'giu')
        : new RegExp(diacriticPattern, 'giu')
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      if (m[0].length === 0) {
        pattern.lastIndex++
        continue
      }
      ranges.push({ start: m.index, end: m.index + m[0].length })
    }
  }
  if (ranges.length === 0) return text

  ranges.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: Array<{ start: number; end: number }> = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else if (last && isMergeableGap(text.slice(last.end, r.start))) {
      last.end = r.end
    } else {
      merged.push({ ...r })
    }
  }

  let out = ''
  let cursor = 0
  for (const r of merged) {
    out += text.slice(cursor, r.start)
    out += `<mark>${text.slice(r.start, r.end)}</mark>`
    cursor = r.end
  }
  out += text.slice(cursor)
  return out
}

/**
 * Creates highlighted content with fuzzy match support
 * Highlights both exact matches and fuzzy matches (e.g., "Hristos" -> "Cristos")
 * Supports diacritic-insensitive matching (e.g., "in" matches "în")
 */
export function createFuzzyHighlightedSnippet(
  content: string,
  queryTerms: string[],
  maxLength: number = 150,
  rawQuery?: string,
): string {
  // Strip HTML tags for cleaner processing
  const plainContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  // 1. Literal substring match against the user's typed query. Matches the
  //    title highlighter so the two stay visually in sync — when the user
  //    types "Cand Isus Hristos m" the snippet marks exactly the same span
  //    as the title, never extending into the trailing "-a" until the user
  //    actually types those characters.
  if (rawQuery !== undefined && rawQuery.length > 0) {
    const cleaned = cleanQueryForHighlight(rawQuery)
    if (cleaned.length > 0) {
      const normFull = removeDiacritics(plainContent).toLowerCase()
      const pos = normFull.indexOf(cleaned)
      if (pos !== -1) {
        const matchEnd = pos + cleaned.length
        const windowStart = Math.max(0, pos - 30)
        const rawEnd = Math.min(plainContent.length, windowStart + maxLength)
        // Make sure the matched span is fully inside the window
        const windowEnd = Math.max(rawEnd, matchEnd)
        const snippet = plainContent.slice(windowStart, windowEnd)
        const localStart = pos - windowStart
        const localEnd = matchEnd - windowStart
        const marked =
          snippet.slice(0, localStart) +
          `<mark>${snippet.slice(localStart, localEnd)}</mark>` +
          snippet.slice(localEnd)
        const prefix = windowStart > 0 ? '...' : ''
        const suffix = windowEnd < plainContent.length ? '...' : ''
        return `${prefix}${marked}${suffix}`
      }
    }
  }

  // Normalize content for diacritic-insensitive matching
  const normalizedContent = removeDiacritics(plainContent).toLowerCase()

  // Find all matches (exact and fuzzy) with their positions
  const matches: Array<{ start: number; end: number; length: number }> = []

  for (const term of queryTerms) {
    const normalizedTerm = removeDiacritics(term).toLowerCase()

    // For short terms (< 3 chars), only match whole words to avoid false positives
    // e.g., "in" should match "in" or "în" but not the "in" inside "furtuni"
    if (term.length < 3) {
      // Use word boundary regex for short terms
      const wordRegex = new RegExp(`\\b${normalizedTerm}\\b`, 'gi')
      let match: RegExpExecArray | null
      while ((match = wordRegex.exec(normalizedContent)) !== null) {
        // Find the actual position in original content (may differ due to diacritics)
        const actualWord = plainContent.substring(
          match.index,
          match.index + match[0].length,
        )
        matches.push({
          start: match.index,
          end: match.index + actualWord.length,
          length: actualWord.length,
        })
      }
    } else {
      // For longer terms, find all occurrences
      let pos = 0
      while ((pos = normalizedContent.indexOf(normalizedTerm, pos)) !== -1) {
        // Get actual length from original content (may be different due to composed chars)
        let actualEnd = pos + normalizedTerm.length
        // Adjust for any length differences in original content
        while (
          actualEnd < plainContent.length &&
          removeDiacritics(plainContent.substring(pos, actualEnd)).toLowerCase()
            .length < normalizedTerm.length
        ) {
          actualEnd++
        }
        matches.push({
          start: pos,
          end: actualEnd,
          length: actualEnd - pos,
        })
        pos += 1
      }

      // Find fuzzy matches (for terms >= 5 chars)
      if (term.length >= 5) {
        const fuzzyMatch = findFuzzyMatchWord(plainContent, term)
        if (fuzzyMatch && !matches.some((m) => m.start === fuzzyMatch.index)) {
          matches.push({
            start: fuzzyMatch.index,
            end: fuzzyMatch.index + fuzzyMatch.word.length,
            length: fuzzyMatch.word.length,
          })
        }
      }
    }
  }

  if (matches.length === 0) {
    // No matches, return start of content
    return plainContent.length > maxLength
      ? `${plainContent.substring(0, maxLength)}...`
      : plainContent
  }

  // (No backward / forward hyphen-word extension here — the exact-phrase
  // path above already covers the literal-typing case, and per-term
  // marks are merged through hyphen / clitic gaps below, which gives the
  // same visual result for queries that span an "m-a" without claiming
  // characters the user never typed.)

  // Sort matches by position, then by length (longer matches first)
  matches.sort((a, b) => a.start - b.start || b.length - a.length)

  // Merge overlapping and adjacent matches. Gaps that are pure whitespace
  // OR a short Romanian clitic contraction (m-a, te-a, ne-am, s-a, …) are
  // swallowed into a single range so users see a continuous highlight on
  // queries like "cand isus hristos m-a mantuit" — the "m-a" sits between
  // two matched terms and visibly belongs to the same phrase.
  const mergedMatches: Array<{ start: number; end: number }> = []
  for (const match of matches) {
    const adjacent = mergedMatches.find((m) => {
      if (match.start < m.end && match.end > m.start) return true // overlapping
      const gap =
        match.start >= m.end
          ? plainContent.substring(m.end, match.start)
          : plainContent.substring(match.end, m.start)
      return isMergeableGap(gap)
    })
    if (adjacent) {
      adjacent.start = Math.min(adjacent.start, match.start)
      adjacent.end = Math.max(adjacent.end, match.end)
    } else {
      mergedMatches.push({ start: match.start, end: match.end })
    }
  }

  // Find the best snippet window (area with most highlighted characters)
  let bestStart = 0
  let bestHighlightChars = 0

  for (const match of mergedMatches) {
    const windowStart = Math.max(0, match.start - 30)
    const windowEnd = windowStart + maxLength
    const highlightChars = mergedMatches
      .filter((m) => m.start >= windowStart && m.end <= windowEnd)
      .reduce((sum, m) => sum + (m.end - m.start), 0)
    if (highlightChars > bestHighlightChars) {
      bestHighlightChars = highlightChars
      bestStart = windowStart
    }
  }

  // Extract snippet
  let snippet = plainContent.substring(bestStart, bestStart + maxLength)

  // Get matches within snippet and adjust positions
  const snippetMatches = mergedMatches
    .filter((m) => m.start >= bestStart && m.end <= bestStart + maxLength)
    .map((m) => ({ start: m.start - bestStart, end: m.end - bestStart }))
    .sort((a, b) => b.start - a.start) // Sort descending for safe replacement

  // Apply highlighting (from end to start to preserve positions)
  for (const match of snippetMatches) {
    const before = snippet.substring(0, match.start)
    const term = snippet.substring(match.start, match.end)
    const after = snippet.substring(match.end)
    snippet = `${before}<mark>${term}</mark>${after}`
  }

  // Add ellipsis
  const prefix = bestStart > 0 ? '...' : ''
  const suffix = bestStart + maxLength < plainContent.length ? '...' : ''

  return `${prefix}${snippet}${suffix}`
}

/**
 * Builds a trigram query for fuzzy matching
 * Uses middle substrings of words to find similar matches
 * e.g., "Hristos" -> searches for "risto", "isto" which also matches "Cristos"
 */
function buildTrigramQuery(terms: string[]): string {
  const allSubstrings: string[] = []

  for (const term of terms) {
    // Add full term if long enough
    if (term.length >= 4) {
      allSubstrings.push(term)
    }
    // Add fuzzy substrings
    allSubstrings.push(...extractFuzzySubstrings(term))
  }

  if (allSubstrings.length === 0) return ''

  // Use OR to match any substring
  return allSubstrings.map((s) => `"${s}"`).join(' OR ')
}

/**
 * Searches songs using FTS5 with three-phase ranking:
 *
 * Phase 1: Standard FTS5 query to find exact/prefix matches
 * Phase 2: Trigram FTS5 query to find fuzzy/similar matches (e.g., "Hristos" ~ "Cristos")
 * Phase 3: Combine results and re-rank by term match count
 *
 * This approach:
 * - Uses standard FTS for fast exact matching
 * - Uses trigram for fuzzy matching of similar words
 * - Properly ranks partial phrase matches (e.g., 5/6 terms matched ranks high)
 *
 * Performance optimizations:
 * - Uses `rank` column instead of bm25() for faster sorting
 * - Simple query structure avoids combinatorial explosion
 * - Limits candidates, returns top results after re-ranking
 *
 * @param query - Search query string
 * @param categoryIds - Optional category IDs to filter results (array)
 * @param limit - Maximum number of results to return (default: 50)
 */
export function searchSongs(
  query: string,
  categoryIds?: number[],
  rawLimit = 50,
  filters?: {
    presentedOnly?: boolean
    inSchedulesOnly?: boolean
    hasKeyLine?: boolean
  },
): SongSearchResult[] {
  const limit = Math.min(Math.max(1, rawLimit), 200)
  const startTime = performance.now()

  try {
    logger.debug(`Searching songs: ${query}`)

    if (!query.trim()) {
      return []
    }

    // Check cache first (before any processing)
    const cacheKey = getSearchCacheKey(query, categoryIds, filters)
    const cachedResults = getFromSearchCache(cacheKey)
    if (cachedResults) {
      logger.debug(
        `Cache hit for: "${query}" (${cachedResults.length} results)`,
      )
      return cachedResults.slice(0, limit)
    }

    const db = getRawDatabase()

    // Songs in a hidden category must never surface in search. Exclude them
    // from every result path below (hymn pre-phase + main phase).
    const hiddenCategoryIds = new Set(getHiddenCategoryIds())
    const isVisible = (r: { categoryId: number | null }): boolean =>
      r.categoryId == null || !hiddenCategoryIds.has(r.categoryId)

    // Build extra filter conditions early for hymn number pre-phase
    const prePhaseExtraConditions: string[] = []
    const prePhaseCategoryParams: number[] = []
    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(',')
      prePhaseExtraConditions.push(`s.category_id IN (${placeholders})`)
      prePhaseCategoryParams.push(...categoryIds)
    }
    if (filters?.presentedOnly) {
      prePhaseExtraConditions.push('s.presentation_count > 0')
    }
    if (filters?.inSchedulesOnly) {
      prePhaseExtraConditions.push(
        `s.id IN (SELECT DISTINCT song_id FROM schedule_items WHERE song_id IS NOT NULL)`,
      )
    }
    if (filters?.hasKeyLine) {
      prePhaseExtraConditions.push(
        `s.key_line IS NOT NULL AND s.key_line != ''`,
      )
    }
    const prePhaseExtraFilter =
      prePhaseExtraConditions.length > 0
        ? `AND ${prePhaseExtraConditions.join(' AND ')}`
        : ''

    // Pre-phase: Hymn number direct lookup (e.g. "#034", "034", "34")
    const hymnRows = searchByHymnNumber(
      query,
      db,
      prePhaseExtraFilter,
      prePhaseCategoryParams,
    )
    if (hymnRows && hymnRows.length > 0) {
      logger.debug(`Hymn number pre-phase: ${hymnRows.length} results`)
      const hymnFinalResults: SongSearchResult[] = hymnRows
        .map((r) => ({
          id: r.id,
          title: r.title,
          categoryId: r.category_id,
          categoryName: r.category_name,
          keyLine: r.key_line,
          highlightedTitle: r.title,
          matchedContent: r.hymn_number ? `Hymn #${r.hymn_number}` : '',
          presentationCount: r.presentation_count,
          score: 100,
        }))
        .filter(isVisible)
        .slice(0, limit)
      setInSearchCache(cacheKey, hymnFinalResults)
      return hymnFinalResults
    }

    const queryTerms = extractSearchTerms(query)

    // Filter to valid terms (terms that exist in corpus)
    const validTermsStart = performance.now()
    let { validTerms } = getValidTerms(queryTerms)
    logger.debug(
      `getValidTerms: ${(performance.now() - validTermsStart).toFixed(1)}ms`,
    )

    // If ALL terms were filtered out, fall back to original terms
    if (validTerms.length === 0 && queryTerms.length > 0) {
      logger.debug(
        'All terms filtered as noise, falling back to original terms',
      )
      validTerms = queryTerms
    }

    logger.debug(
      `Query terms: ${queryTerms.join(', ')} | Valid: ${validTerms.join(', ')}`,
    )

    // If still no valid terms (shouldn't happen), return empty
    if (validTerms.length === 0) {
      logger.debug('No valid search terms found')
      return []
    }

    // Expand valid terms with synonyms for broader search
    const expandedTerms = expandTermsWithSynonyms(validTerms)

    // Build FTS query using expanded terms for broader results, but pass the
    // pre-expansion terms separately so the title-restricted clause matches
    // the user's literal title query without diluting on synonym variants.
    const ftsQuery = buildSearchQuery(expandedTerms.join(' '), validTerms)

    if (!ftsQuery) {
      return []
    }

    logger.debug(`FTS query: ${ftsQuery}`)

    // Phase 1: Standard FTS5 search for exact/prefix matches
    // Build additional SQL filters
    const extraConditions: string[] = []
    let categoryParams: number[] = []
    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(',')
      extraConditions.push(`s.category_id IN (${placeholders})`)
      categoryParams = categoryIds
    }
    if (filters?.presentedOnly) {
      extraConditions.push('s.presentation_count > 0')
    }
    if (filters?.inSchedulesOnly) {
      extraConditions.push(
        `s.id IN (SELECT DISTINCT song_id FROM schedule_items WHERE song_id IS NOT NULL)`,
      )
    }
    if (filters?.hasKeyLine) {
      extraConditions.push(`s.key_line IS NOT NULL AND s.key_line != ''`)
    }
    const extraFilter =
      extraConditions.length > 0 ? `AND ${extraConditions.join(' AND ')}` : ''
    const standardQueryParams = [ftsQuery, ...categoryParams]

    const standardResults = db
      .query(
        `
      SELECT
        s.id,
        s.title,
        s.category_id,
        sc.name as category_name,
        COALESCE(sc.priority, 1) as category_priority,
        s.presentation_count,
        s.key_line,
        songs_fts.content as full_content,
        songs_fts.title as fts_title,
        COALESCE((SELECT GROUP_CONCAT(content, ' ') FROM (SELECT content FROM song_slides WHERE song_id = s.id ORDER BY sort_order)), '') as original_content,
        rank as bm25_rank
      FROM songs_fts
      JOIN songs s ON s.id = songs_fts.song_id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE songs_fts MATCH ? ${extraFilter}
      ORDER BY rank
      LIMIT 100
    `,
      )
      .all(...standardQueryParams) as Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      category_priority: number
      presentation_count: number
      key_line: string | null
      full_content: string
      fts_title: string
      original_content: string
      bm25_rank: number
    }>

    const phase1Elapsed = performance.now() - startTime
    logger.debug(
      `Phase 1 (standard): Found ${standardResults.length} results in ${phase1Elapsed.toFixed(1)}ms`,
    )

    // Phase 2: Trigram search for fuzzy matches (use expanded terms)
    let phase2Elapsed = phase1Elapsed
    const trigramQuery = buildTrigramQuery(expandedTerms)
    let trigramResults: Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      category_priority: number
      presentation_count: number
      key_line: string | null
      full_content: string
      bm25_rank: number
    }> = []

    if (trigramQuery) {
      try {
        const trigramQueryParams = [trigramQuery, ...categoryParams]
        trigramResults = db
          .query(
            `
          SELECT
            s.id,
            s.title,
            s.category_id,
            sc.name as category_name,
            COALESCE(sc.priority, 1) as category_priority,
            s.presentation_count,
            s.key_line,
            songs_fts_trigram.content as full_content,
            rank as bm25_rank
          FROM songs_fts_trigram
          JOIN songs s ON s.id = songs_fts_trigram.song_id
          LEFT JOIN song_categories sc ON s.category_id = sc.id
          WHERE songs_fts_trigram MATCH ? ${extraFilter}
          ORDER BY rank
          LIMIT 50
        `,
          )
          .all(...trigramQueryParams) as typeof trigramResults

        phase2Elapsed = performance.now() - startTime
        logger.debug(
          `Phase 2 (trigram): Found ${trigramResults.length} results in ${phase2Elapsed.toFixed(1)}ms`,
        )
      } catch (e) {
        // Trigram table might not exist yet, continue without it
        logger.debug(`Trigram search failed (table may not exist): ${e}`)
      }
    }

    // Combine results - use Map to deduplicate by song ID
    const candidateMap = new Map<
      number,
      {
        id: number
        title: string
        category_id: number | null
        category_name: string | null
        category_priority: number
        presentation_count: number
        key_line: string | null
        full_content: string
        fts_title: string
        original_content: string
        bm25_rank: number
        fromTrigram: boolean
      }
    >()

    // Add standard results first
    for (const r of standardResults) {
      candidateMap.set(r.id, { ...r, fromTrigram: false })
    }

    // Add trigram results (without overwriting standard results)
    for (const r of trigramResults) {
      if (!candidateMap.has(r.id)) {
        candidateMap.set(r.id, {
          ...r,
          fts_title: removeDiacritics(r.title).toLowerCase(),
          original_content: '',
          fromTrigram: true,
        })
      }
    }

    const candidates = Array.from(candidateMap.values())
    logger.debug(`Combined: ${candidates.length} unique candidates`)

    // Phase 3: Calculate match scores using phrase-based scoring
    // FTS content is already diacritics-free (normalizeForIndex strips diacritics)
    // so we skip redundant removeDiacritics calls in scoring
    // Title bonus: songs where the search matches the title get a ranking edge
    const TITLE_BONUS = 0.15
    // key_line boost: 15% additive bonus for songs that have a key line set
    const KEY_LINE_BOOST = 0.15
    // presentationCount logarithmic boost: up to ~10% extra for frequently presented songs
    // log10(1+n) / log10(1+100) * 0.1 ≈ 0-10% for n in [0, 100]
    const PRESENTATION_BOOST_SCALE = 0.1
    const PRESENTATION_BOOST_DENOM = Math.log10(101)

    const scoredResults = candidates.map((r) => {
      // Score against the user's ORIGINAL (pre-synonym-expansion) terms.
      // Synonyms broaden FTS recall — they should not be appended to the
      // queryTerms used for phrase / order detection or the joined exact
      // phrase will never match a real title.
      const titleScore = calculateTitleScoreNormalized(r.fts_title, validTerms)

      const contentScore = calculateBestPhraseScoreNormalized(
        r.full_content,
        validTerms,
      )

      // Use best match location as base score (don't penalize content-only matches)
      // Add a title bonus so title matches rank above content-only matches
      const termScore =
        Math.max(titleScore, contentScore) + titleScore * TITLE_BONUS

      // key_line boost: songs with a key line get +15% of base score
      const keyLineMultiplier =
        r.key_line && r.key_line.length > 0 ? 1 + KEY_LINE_BOOST : 1

      // presentationCount logarithmic boost: frequently presented songs rank slightly higher
      const presentationMultiplier =
        1 +
        (Math.log10(1 + (r.presentation_count ?? 0)) /
          PRESENTATION_BOOST_DENOM) *
          PRESENTATION_BOOST_SCALE

      // Apply all boosts and category priority multiplier
      const boostedScore =
        termScore *
        r.category_priority *
        keyLineMultiplier *
        presentationMultiplier

      return {
        ...r,
        titleScore,
        contentScore,
        termScore,
        boostedScore,
      }
    })

    // Sort by: boosted score (desc), term score (desc), title score (desc), FTS over trigram, then BM25 rank (asc)
    scoredResults.sort((a, b) => {
      // Primary: boosted score (category priority applied)
      if (b.boostedScore !== a.boostedScore) {
        return b.boostedScore - a.boostedScore
      }
      // Secondary: more terms matched = higher priority
      if (b.termScore !== a.termScore) {
        return b.termScore - a.termScore
      }
      // Tertiary: prefer title matches over content-only matches
      if (b.titleScore !== a.titleScore) {
        return b.titleScore - a.titleScore
      }
      // Quaternary: prioritize FTS results over trigram results
      // (trigram BM25 scores are not comparable to FTS scores)
      if (a.fromTrigram !== b.fromTrigram) {
        return a.fromTrigram ? 1 : -1 // FTS (false) comes before trigram (true)
      }
      // Quinary: better BM25 score (lower rank value = better match)
      return a.bm25_rank - b.bm25_rank
    })

    // Return top results based on limit
    const topResults = scoredResults.slice(0, limit)

    const phase3Elapsed = performance.now() - startTime
    logger.debug(
      `Phase 3: Re-ranked ${candidates.length} candidates in ${(phase3Elapsed - phase2Elapsed).toFixed(1)}ms. Top score: ${topResults[0]?.termScore ?? 0}%`,
    )

    const finalResults = topResults.map((r) => {
      // Use original content (with diacritics) for snippet highlighting
      // Fall back to FTS content if original is not available
      const contentForSnippet = r.original_content || r.full_content
      // Pass the raw user query so the highlighter can prefer a literal
      // substring match (incremental typing produces the same visual mark
      // in title and snippet, one character at a time).
      const matchedContent = createFuzzyHighlightedSnippet(
        contentForSnippet,
        expandedTerms,
        undefined,
        query,
      )

      // Highlight original title with diacritic-insensitive matching
      const highlightedTitle = highlightWithDiacritics(
        r.title,
        expandedTerms,
        query,
      )

      return {
        id: r.id,
        title: r.title,
        categoryId: r.category_id,
        categoryName: r.category_name,
        keyLine: r.key_line,
        highlightedTitle,
        matchedContent,
        presentationCount: r.presentation_count,
        score: Math.min(100, Math.round(r.boostedScore)),
      }
    })
    // Drop any songs whose category is hidden.
    const visibleResults = finalResults.filter(isVisible)

    // Cache results for future queries
    setInSearchCache(cacheKey, visibleResults)

    const elapsed = performance.now() - startTime
    logger.debug(
      `Search completed: "${query}" → ${visibleResults.length} results in ${elapsed.toFixed(1)}ms`,
    )

    return visibleResults
  } catch (error) {
    logger.error(`Failed to search songs with query "${query}": ${error}`)
    return []
  }
}
