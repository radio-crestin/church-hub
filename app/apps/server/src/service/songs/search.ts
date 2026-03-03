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
  log('debug', 'Search cache cleared')
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

  log('debug', 'Loading synonyms from database')

  const setting = getSetting('app_settings', 'search_synonyms')
  const synonymMap = new Map<string, string[]>()

  if (!setting) {
    log('debug', 'No synonyms configured')
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

    log('debug', `Loaded ${config.groups.length} synonym groups`)
  } catch (error) {
    log('error', `Failed to parse synonyms config: ${error}`)
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
    log('debug', `Expanded terms: ${terms.join(', ')} -> ${result.join(', ')}`)
  }

  return result
}

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-search] ${message}`)
}

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

  return expandedWords.join(' ')
}

/**
 * Updates the FTS index for a specific song (both standard and trigram)
 */
export function updateSearchIndex(songId: number): void {
  try {
    log('debug', `Updating search index for song: ${songId}`)

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
      log('debug', `Song not found for indexing: ${songId}`)
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

    log('debug', `Search index updated for song: ${songId}`)
  } catch (error) {
    log('error', `Failed to update search index: ${error}`)
  }
}

/**
 * Removes a song from the FTS index (both standard and trigram)
 */
export function removeFromSearchIndex(songId: number): void {
  try {
    log('debug', `Removing song from search index: ${songId}`)

    const db = getRawDatabase()
    db.query('DELETE FROM songs_fts WHERE song_id = ?').run(songId)
    db.query('DELETE FROM songs_fts_trigram WHERE song_id = ?').run(songId)

    log('debug', `Song removed from search index: ${songId}`)
  } catch (error) {
    log('error', `Failed to remove from search index: ${error}`)
  }
}

/**
 * Updates the FTS index for all songs in a category
 * Called when a category name is updated
 */
export function updateSearchIndexByCategory(categoryId: number): void {
  try {
    log('debug', `Updating search index for category: ${categoryId}`)

    const db = getRawDatabase()
    const songsQuery = db.query('SELECT id FROM songs WHERE category_id = ?')
    const songs = songsQuery.all(categoryId) as { id: number }[]

    for (const song of songs) {
      updateSearchIndex(song.id)
    }

    log('debug', `Updated ${songs.length} songs for category: ${categoryId}`)
  } catch (error) {
    log('error', `Failed to update search index for category: ${error}`)
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
    log('info', `Batch updating search index for ${songIds.length} songs`)

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

      log(
        'info',
        `[PERF] Search index update: ${totalTime.toFixed(2)}ms | Delete: ${deleteTime.toFixed(0)}ms | FTS: ${ftsTime.toFixed(0)}ms`,
      )
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to batch update search index: ${error}`)
  }
}

/**
 * Rebuilds the entire search index (both standard and trigram)
 * Uses JavaScript normalization to properly expand Romanian contractions
 * and handle hyphenated words for better searchability
 */
export function rebuildSearchIndex(): void {
  try {
    log('info', 'Rebuilding search index...')

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

    log('info', `Found ${songs.length} songs to index`)

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

      log('info', `Search index rebuilt: ${songs.length} songs indexed`)
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to rebuild search index: ${error}`)
  }
}

/**
 * Extracts and sanitizes search terms from query text
 */
export function extractSearchTerms(queryText: string): string[] {
  const sanitized = removeDiacritics(queryText)
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

  log(
    'debug',
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
export function buildSearchQuery(queryText: string): string {
  const allTerms = extractSearchTerms(queryText)

  // Filter out single-character terms to reduce noise in FTS queries
  // They cause too many false positives (e.g. "a", "m", "s" match almost everything)
  const terms = allTerms.filter((t) => t.length > 1)

  // If all terms were single-char, fall back to originals to avoid empty query
  const effectiveTerms = terms.length > 0 ? terms : allTerms

  if (effectiveTerms.length === 0) return ''

  if (effectiveTerms.length === 1) {
    return `"${effectiveTerms[0]}"*`
  }

  // Simple tiered query - avoids combinatorial explosion
  const phraseQuery = `"${effectiveTerms.join(' ')}"` // Exact phrase
  const nearQuery = `NEAR(${effectiveTerms.map((t) => `"${t}"`).join(' ')}, 10)` // Proximity (wider window)
  const orQuery = effectiveTerms.map((t) => `"${t}"*`).join(' OR ') // Broad match

  return `(${phraseQuery}) OR (${nearQuery}) OR (${orQuery})`
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

  let matchedCount = 0
  let lastMatchPos = -1
  let inOrderCount = 0

  for (const term of queryTerms) {
    const pos = title.indexOf(term)
    if (pos !== -1) {
      matchedCount++
      if (pos > lastMatchPos) {
        inOrderCount++
        lastMatchPos = pos
      }
    }
  }

  if (matchedCount === 0) return 0

  const matchPercentage = matchedCount / queryTerms.length
  const orderBonus = inOrderCount === matchedCount ? 0.2 : 0
  const allMatchedBonus = matchedCount === queryTerms.length ? 0.2 : 0

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
 * Creates highlighted content with fuzzy match support
 * Highlights both exact matches and fuzzy matches (e.g., "Hristos" -> "Cristos")
 * Supports diacritic-insensitive matching (e.g., "in" matches "în")
 */
function createFuzzyHighlightedSnippet(
  content: string,
  queryTerms: string[],
  maxLength: number = 150,
): string {
  // Strip HTML tags for cleaner processing
  const plainContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

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

  // Sort matches by position, then by length (longer matches first)
  matches.sort((a, b) => a.start - b.start || b.length - a.length)

  // Merge overlapping matches - keep longer ones, remove shorter overlapping
  const mergedMatches: Array<{ start: number; end: number }> = []
  for (const match of matches) {
    const overlaps = mergedMatches.some(
      (m) => match.start < m.end && match.end > m.start,
    )
    if (!overlaps) {
      mergedMatches.push({ start: match.start, end: match.end })
    }
  }

  // Find the best snippet window (area with most matches)
  let bestStart = 0
  let bestMatchCount = 0

  for (const match of mergedMatches) {
    const windowStart = Math.max(0, match.start - 30)
    const windowEnd = windowStart + maxLength
    const matchesInWindow = mergedMatches.filter(
      (m) => m.start >= windowStart && m.end <= windowEnd,
    ).length
    if (matchesInWindow > bestMatchCount) {
      bestMatchCount = matchesInWindow
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
  limit = 50,
  filters?: {
    presentedOnly?: boolean
    inSchedulesOnly?: boolean
    hasKeyLine?: boolean
  },
): SongSearchResult[] {
  const startTime = performance.now()

  try {
    log('debug', `Searching songs: ${query}`)

    if (!query.trim()) {
      return []
    }

    // Check cache first (before any processing)
    const cacheKey = getSearchCacheKey(query, categoryIds, filters)
    const cachedResults = getFromSearchCache(cacheKey)
    if (cachedResults) {
      log(
        'debug',
        `Cache hit for: "${query}" (${cachedResults.length} results)`,
      )
      return cachedResults.slice(0, limit)
    }

    const db = getRawDatabase()

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
      log('debug', `Hymn number pre-phase: ${hymnRows.length} results`)
      const hymnFinalResults: SongSearchResult[] = hymnRows
        .slice(0, limit)
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
      setInSearchCache(cacheKey, hymnFinalResults)
      return hymnFinalResults
    }

    const queryTerms = extractSearchTerms(query)

    // Filter to valid terms (terms that exist in corpus)
    const validTermsStart = performance.now()
    let { validTerms } = getValidTerms(queryTerms)
    log(
      'debug',
      `getValidTerms: ${(performance.now() - validTermsStart).toFixed(1)}ms`,
    )

    // If ALL terms were filtered out, fall back to original terms
    if (validTerms.length === 0 && queryTerms.length > 0) {
      log(
        'debug',
        'All terms filtered as noise, falling back to original terms',
      )
      validTerms = queryTerms
    }

    log(
      'debug',
      `Query terms: ${queryTerms.join(', ')} | Valid: ${validTerms.join(', ')}`,
    )

    // If still no valid terms (shouldn't happen), return empty
    if (validTerms.length === 0) {
      log('debug', 'No valid search terms found')
      return []
    }

    // Expand valid terms with synonyms for broader search
    const expandedTerms = expandTermsWithSynonyms(validTerms)

    // Build FTS query using expanded terms for broader results
    const ftsQuery = buildSearchQuery(expandedTerms.join(' '))

    if (!ftsQuery) {
      return []
    }

    log('debug', `FTS query: ${ftsQuery}`)

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
        highlight(songs_fts, 1, '<mark>', '</mark>') as highlighted_title,
        snippet(songs_fts, 3, '<mark>', '</mark>', '...', 30) as matched_content,
        songs_fts.content as full_content,
        songs_fts.title as fts_title,
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
      highlighted_title: string
      matched_content: string
      full_content: string
      fts_title: string
      bm25_rank: number
    }>

    const phase1Elapsed = performance.now() - startTime
    log(
      'debug',
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
        log(
          'debug',
          `Phase 2 (trigram): Found ${trigramResults.length} results in ${phase2Elapsed.toFixed(1)}ms`,
        )
      } catch (e) {
        // Trigram table might not exist yet, continue without it
        log('debug', `Trigram search failed (table may not exist): ${e}`)
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
        highlighted_title: string
        matched_content: string
        full_content: string
        fts_title: string
        bm25_rank: number
        fromTrigram: boolean
      }
    >()

    // Add standard results first (they have highlighting)
    for (const r of standardResults) {
      candidateMap.set(r.id, { ...r, fromTrigram: false })
    }

    // Add trigram results (without overwriting standard results)
    for (const r of trigramResults) {
      if (!candidateMap.has(r.id)) {
        candidateMap.set(r.id, {
          ...r,
          fts_title: removeDiacritics(r.title).toLowerCase(),
          highlighted_title: r.title,
          matched_content: '',
          fromTrigram: true,
        })
      }
    }

    const candidates = Array.from(candidateMap.values())
    log('debug', `Combined: ${candidates.length} unique candidates`)

    // Phase 3: Calculate match scores using phrase-based scoring
    // FTS content is already diacritics-free (normalizeForIndex strips diacritics)
    // so we skip redundant removeDiacritics calls in scoring
    const TITLE_WEIGHT = 2
    const CONTENT_WEIGHT = 1
    // key_line boost: 15% additive bonus for songs that have a key line set
    const KEY_LINE_BOOST = 0.15
    // presentationCount logarithmic boost: up to ~10% extra for frequently presented songs
    // log10(1+n) / log10(1+100) * 0.1 ≈ 0-10% for n in [0, 100]
    const PRESENTATION_BOOST_SCALE = 0.1
    const PRESENTATION_BOOST_DENOM = Math.log10(101)

    const scoredResults = candidates.map((r) => {
      // Use pre-normalized fts_title (already diacritics-free) for scoring
      const titleScore = calculateTitleScoreNormalized(
        r.fts_title,
        expandedTerms,
      )

      // Use pre-normalized full_content (already diacritics-free) for scoring
      const contentScore = calculateBestPhraseScoreNormalized(
        r.full_content,
        expandedTerms,
      )

      // Weighted combined score: title matches count 2x more than content matches
      const termScore =
        (titleScore * TITLE_WEIGHT + contentScore * CONTENT_WEIGHT) /
        (TITLE_WEIGHT + CONTENT_WEIGHT)

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
    log(
      'debug',
      `Phase 3: Re-ranked ${candidates.length} candidates in ${(phase3Elapsed - phase2Elapsed).toFixed(1)}ms. Top score: ${topResults[0]?.termScore ?? 0}%`,
    )

    const finalResults = topResults.map((r) => {
      // Always use fuzzy highlighting to ensure fuzzy matches are highlighted
      // (e.g., "Cristos" highlighted when searching "Hristos")
      // Use expanded terms (includes synonyms) for highlighting
      const matchedContent = createFuzzyHighlightedSnippet(
        r.full_content,
        expandedTerms,
      )

      return {
        id: r.id,
        title: r.title,
        categoryId: r.category_id,
        categoryName: r.category_name,
        keyLine: r.key_line,
        highlightedTitle: r.highlighted_title,
        matchedContent,
        presentationCount: r.presentation_count,
        score: Math.min(100, Math.round(r.boostedScore)),
      }
    })

    // Cache results for future queries
    setInSearchCache(cacheKey, finalResults)

    const elapsed = performance.now() - startTime
    log(
      'debug',
      `Search completed: "${query}" → ${finalResults.length} results in ${elapsed.toFixed(1)}ms`,
    )

    return finalResults
  } catch (error) {
    log('error', `Failed to search songs with query "${query}": ${error}`)
    return []
  }
}
