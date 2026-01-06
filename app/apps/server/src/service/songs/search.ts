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

    // Update standard FTS index
    db.query('DELETE FROM songs_fts WHERE song_id = ?').run(songId)
    db.query(`
      INSERT INTO songs_fts (song_id, title, category_name, content)
      VALUES (?, ?, ?, ?)
    `).run(songId, song.title, song.category_name ?? '', combinedContent)

    // Update trigram FTS index for fuzzy matching
    db.query('DELETE FROM songs_fts_trigram WHERE song_id = ?').run(songId)
    db.query(`
      INSERT INTO songs_fts_trigram (song_id, title, content)
      VALUES (?, ?, ?)
    `).run(songId, song.title, combinedContent)

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
 * Much faster than calling updateSearchIndex() individually for each song
 */
export function batchUpdateSearchIndex(songIds: number[]): void {
  if (songIds.length === 0) return

  try {
    const totalStart = performance.now()
    log('info', `Batch updating search index for ${songIds.length} songs`)

    const db = getRawDatabase()

    db.exec('BEGIN TRANSACTION')

    try {
      // Build placeholders for IN clause
      const placeholders = songIds.map(() => '?').join(',')

      // Delete existing FTS entries for these songs
      const deleteStart = performance.now()
      db.query(`DELETE FROM songs_fts WHERE song_id IN (${placeholders})`).run(
        ...songIds,
      )
      db.query(
        `DELETE FROM songs_fts_trigram WHERE song_id IN (${placeholders})`,
      ).run(...songIds)
      const deleteTime = performance.now() - deleteStart

      // Batch insert all songs with their slides in a single query
      const ftsStart = performance.now()
      db.query(`
        INSERT INTO songs_fts (song_id, title, category_name, content)
        SELECT
          s.id,
          s.title,
          COALESCE(sc.name, ''),
          COALESCE(GROUP_CONCAT(ss.content, ' '), '')
        FROM songs s
        LEFT JOIN song_categories sc ON s.category_id = sc.id
        LEFT JOIN (
          SELECT song_id, content FROM song_slides ORDER BY sort_order
        ) ss ON ss.song_id = s.id
        WHERE s.id IN (${placeholders})
        GROUP BY s.id
      `).run(...songIds)
      const ftsTime = performance.now() - ftsStart

      // Also update trigram index
      const trigramStart = performance.now()
      db.query(`
        INSERT INTO songs_fts_trigram (song_id, title, content)
        SELECT
          s.id,
          s.title,
          COALESCE(GROUP_CONCAT(ss.content, ' '), '')
        FROM songs s
        LEFT JOIN (
          SELECT song_id, content FROM song_slides ORDER BY sort_order
        ) ss ON ss.song_id = s.id
        WHERE s.id IN (${placeholders})
        GROUP BY s.id
      `).run(...songIds)
      const trigramTime = performance.now() - trigramStart

      db.exec('COMMIT')
      const totalTime = performance.now() - totalStart
      log(
        'info',
        `[PERF] Search index update: ${totalTime.toFixed(2)}ms | Delete: ${deleteTime.toFixed(0)}ms | FTS: ${ftsTime.toFixed(0)}ms | Trigram: ${trigramTime.toFixed(0)}ms`,
      )
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to batch update search index: ${error}`)
  }
}

/**
 * Rebuilds the entire search index (both standard and trigram)
 * This is much faster than updating each song individually
 */
export function rebuildSearchIndex(): void {
  try {
    log('info', 'Rebuilding search index...')

    const db = getRawDatabase()

    // Use a transaction for atomicity
    db.exec('BEGIN TRANSACTION')

    try {
      // Clear existing indexes
      db.exec('DELETE FROM songs_fts')
      db.exec('DELETE FROM songs_fts_trigram')

      // Batch insert all songs with their slides in a single query
      // Uses GROUP_CONCAT to combine all slide content per song
      // Subquery ensures slides are ordered by sort_order before concatenation
      const result = db.run(`
        INSERT INTO songs_fts (song_id, title, category_name, content)
        SELECT
          s.id,
          s.title,
          COALESCE(sc.name, ''),
          COALESCE(GROUP_CONCAT(ss.content, ' '), '')
        FROM songs s
        LEFT JOIN song_categories sc ON s.category_id = sc.id
        LEFT JOIN (
          SELECT song_id, content FROM song_slides ORDER BY sort_order
        ) ss ON ss.song_id = s.id
        GROUP BY s.id
      `)

      // Also rebuild trigram index for fuzzy matching
      db.run(`
        INSERT INTO songs_fts_trigram (song_id, title, content)
        SELECT
          s.id,
          s.title,
          COALESCE(GROUP_CONCAT(ss.content, ' '), '')
        FROM songs s
        LEFT JOIN (
          SELECT song_id, content FROM song_slides ORDER BY sort_order
        ) ss ON ss.song_id = s.id
        GROUP BY s.id
      `)

      db.exec('COMMIT')
      log('info', `Search index rebuilt: ${result.changes} songs indexed`)
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to rebuild search index: ${error}`)
  }
}

/**
 * Extracts and sanitizes search terms from query text
 */
function extractSearchTerms(queryText: string): string[] {
  const sanitized = queryText
    .replace(/['"]/g, '')
    .replace(/[*()^:+\-\\]/g, ' ')
    .trim()
    .toLowerCase()

  return sanitized.split(/\s+/).filter((t) => t.length > 0)
}

/**
 * Filters query terms to only those that exist meaningfully in the corpus
 * Excludes:
 * - Terms that don't exist at all (typos, random strings)
 * - Terms matching very few documents (<10) - likely noise like IDs or rare typos
 */
function getValidTerms(
  db: ReturnType<typeof getDatabase>,
  terms: string[],
): { validTerms: string[]; termCounts: Map<string, number> } {
  const MIN_TERM_FREQUENCY = 10 // Terms must match at least this many docs
  const termCounts = new Map<string, number>()
  const validTerms: string[] = []

  for (const term of terms) {
    try {
      // Check if term exists in FTS index (with prefix matching)
      const result = db
        .query(
          `SELECT COUNT(*) as count FROM songs_fts WHERE songs_fts MATCH ?`,
        )
        .get(`"${term}"*`) as { count: number } | null

      const count = result?.count ?? 0
      // Only include terms that appear in enough documents
      // This filters out noise like "123" which might match a few song titles
      if (count >= MIN_TERM_FREQUENCY) {
        validTerms.push(term)
        termCounts.set(term, count)
      }
    } catch {
      // Term might have special characters, skip it
    }
  }

  return { validTerms, termCounts }
}

/**
 * Builds a simple FTS5 query optimized for performance
 * Uses OR for broad matching, letting post-processing handle ranking
 *
 * Strategy:
 * 1. Exact phrase match (highest BM25 boost)
 * 2. NEAR query for proximity matching
 * 3. OR with prefix for each term (broad candidate search)
 */
function buildSearchQuery(queryText: string): string {
  const terms = extractSearchTerms(queryText)

  if (terms.length === 0) return ''

  if (terms.length === 1) {
    return `"${terms[0]}"*`
  }

  // Simple tiered query - avoids combinatorial explosion
  const phraseQuery = `"${terms.join(' ')}"` // Exact phrase
  const nearQuery = `NEAR(${terms.map((t) => `"${t}"`).join(' ')}, 10)` // Proximity (wider window)
  const orQuery = terms.map((t) => `"${t}"*`).join(' OR ') // Broad match

  return `(${phraseQuery}) OR (${nearQuery}) OR (${orQuery})`
}

/**
 * Calculates title match score with bonuses for exact phrase and term order
 * Title matching is simpler since titles are short
 *
 * Score breakdown:
 * - 100: Title starts with exact phrase
 * - 95: Exact phrase match (anywhere in title)
 * - 80-94: All terms present in correct order
 * - 60-79: All terms present (any order)
 * - 0-59: Partial term matches
 */
function calculateTitleScore(title: string, queryTerms: string[]): number {
  if (!title || queryTerms.length === 0) return 0

  const normalizedTitle = removeDiacritics(title).toLowerCase()
  const normalizedTerms = queryTerms.map((t) =>
    removeDiacritics(t).toLowerCase(),
  )

  const exactPhrase = normalizedTerms.join(' ')

  // Highest score: title starts with the exact phrase
  if (normalizedTitle.startsWith(exactPhrase)) {
    return 100
  }

  // Second highest: phrase appears elsewhere in title
  if (normalizedTitle.includes(exactPhrase)) {
    return 95
  }

  // Count matched terms and check order
  let matchedCount = 0
  let lastMatchPos = -1
  let inOrderCount = 0

  for (const term of normalizedTerms) {
    const pos = normalizedTitle.indexOf(term)
    if (pos !== -1) {
      matchedCount++
      if (pos > lastMatchPos) {
        inOrderCount++
        lastMatchPos = pos
      }
    }
  }

  if (matchedCount === 0) return 0

  const matchPercentage = matchedCount / normalizedTerms.length
  const orderBonus = inOrderCount === matchedCount ? 0.2 : 0
  const allMatchedBonus = matchedCount === normalizedTerms.length ? 0.2 : 0

  // Score: base 54% for matches, +20% for all matched, +20% for correct order (max 94)
  return Math.round(
    matchPercentage * 54 + allMatchedBonus * 100 + orderBonus * 100,
  )
}

/**
 * Finds the best matching phrase/region in content and returns its score
 * Instead of counting scattered word occurrences, this finds the SINGLE BEST
 * contiguous region where query terms cluster together
 *
 * Score breakdown:
 * - 100: Exact phrase match found
 * - 70-99: All terms found in a tight cluster
 * - 40-69: Most terms found with reasonable proximity
 * - 0-39: Sparse/partial matches
 */
function calculateBestPhraseScore(
  content: string,
  queryTerms: string[],
): number {
  if (!content || queryTerms.length === 0) return 0

  const normalizedContent = removeDiacritics(content).toLowerCase()
  const normalizedTerms = queryTerms.map((t) =>
    removeDiacritics(t).toLowerCase(),
  )

  // Check for exact phrase match (highest score)
  const exactPhrase = normalizedTerms.join(' ')
  if (normalizedContent.includes(exactPhrase)) {
    return 100
  }

  // Find all positions where each query term appears
  const termPositions: Map<number, number[]> = new Map()
  for (let i = 0; i < normalizedTerms.length; i++) {
    const term = normalizedTerms[i]
    const positions: number[] = []
    let pos = 0
    while ((pos = normalizedContent.indexOf(term, pos)) !== -1) {
      positions.push(pos)
      pos++
    }
    if (positions.length > 0) {
      termPositions.set(i, positions)
    }
  }

  // If no terms found at all
  if (termPositions.size === 0) return 0

  // If only one term type found, simple percentage score
  if (termPositions.size === 1) {
    return Math.round((1 / normalizedTerms.length) * 50)
  }

  // Find the best cluster: region where most terms appear closest together
  let bestScore = 0

  // Try starting from each occurrence of each term
  for (const [startTermIdx, startPositions] of termPositions) {
    for (const anchorPos of startPositions) {
      // For this anchor position, find the best cluster of terms
      const termsInCluster = new Set<number>([startTermIdx])
      let clusterStart = anchorPos
      let clusterEnd = anchorPos + normalizedTerms[startTermIdx].length

      // Greedily add closest terms to the cluster
      const CLUSTER_RADIUS = 150 // Max chars to look for related terms

      for (const [termIdx, positions] of termPositions) {
        if (termIdx === startTermIdx) continue

        // Find the closest occurrence to our current cluster
        let closestPos = -1
        let closestDist = Number.POSITIVE_INFINITY

        for (const pos of positions) {
          const distToCluster = Math.min(
            Math.abs(pos - clusterStart),
            Math.abs(pos - clusterEnd),
          )
          if (distToCluster < closestDist && distToCluster <= CLUSTER_RADIUS) {
            closestDist = distToCluster
            closestPos = pos
          }
        }

        if (closestPos !== -1) {
          termsInCluster.add(termIdx)
          clusterStart = Math.min(clusterStart, closestPos)
          clusterEnd = Math.max(
            clusterEnd,
            closestPos + normalizedTerms[termIdx].length,
          )
        }
      }

      // Score this cluster
      const matchRatio = termsInCluster.size / normalizedTerms.length
      const clusterSpan = clusterEnd - clusterStart

      // Check if terms appear in query order within the cluster
      let inOrder = true
      let lastPos = -1
      for (let i = 0; i < normalizedTerms.length; i++) {
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

      // Calculate score:
      // - Base: 50% for match ratio
      // - Proximity bonus: up to 30% (tighter cluster = higher)
      // - Order bonus: 20% if terms appear in correct order
      const baseScore = matchRatio * 50
      const idealSpan = termsInCluster.size * 10 // ~10 chars per term is ideal
      const proximityScore =
        termsInCluster.size > 1
          ? Math.max(0, 30 * (1 - Math.min(1, (clusterSpan - idealSpan) / 200)))
          : 0
      const orderScore = inOrder ? 20 : 0

      const clusterScore = baseScore + proximityScore + orderScore
      bestScore = Math.max(bestScore, clusterScore)
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
 * - Limits candidates, returns top 50 after re-ranking
 *
 * @param query - Search query string
 * @param categoryId - Optional category ID to filter results
 */
export function searchSongs(
  query: string,
  categoryId?: number,
): SongSearchResult[] {
  try {
    log('debug', `Searching songs: ${query}`)

    if (!query.trim()) {
      return []
    }

    const db = getRawDatabase()
    const queryTerms = extractSearchTerms(query)

    // Filter to valid terms (terms that exist in corpus) - ignore noise like "123"
    let { validTerms, termCounts } = getValidTerms(db, queryTerms)

    // If ALL terms were filtered out, fall back to original terms
    // This handles cases like searching "001" where the user wants that specific song
    // vs adding "123" noise to a longer query like "Isus Cristos 123"
    if (validTerms.length === 0 && queryTerms.length > 0) {
      log(
        'debug',
        'All terms filtered as noise, falling back to original terms',
      )
      validTerms = queryTerms
      // Get actual counts for these terms (even if below threshold)
      for (const term of queryTerms) {
        try {
          const result = db
            .query(
              `SELECT COUNT(*) as count FROM songs_fts WHERE songs_fts MATCH ?`,
            )
            .get(`"${term}"*`) as { count: number } | null
          termCounts.set(term, result?.count ?? 0)
        } catch {
          termCounts.set(term, 0)
        }
      }
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

    // Update term counts for expanded terms
    for (const term of expandedTerms) {
      if (!termCounts.has(term)) {
        try {
          const result = db
            .query(
              `SELECT COUNT(*) as count FROM songs_fts WHERE songs_fts MATCH ?`,
            )
            .get(`"${term}"*`) as { count: number } | null
          termCounts.set(term, result?.count ?? 0)
        } catch {
          termCounts.set(term, 0)
        }
      }
    }

    // Build FTS query using expanded terms for broader results
    const ftsQuery = buildSearchQuery(expandedTerms.join(' '))

    if (!ftsQuery) {
      return []
    }

    log('debug', `FTS query: ${ftsQuery}`)

    // Phase 1: Standard FTS5 search for exact/prefix matches
    const categoryFilter =
      categoryId !== undefined ? 'AND s.category_id = ?' : ''
    const standardQueryParams =
      categoryId !== undefined ? [ftsQuery, categoryId] : [ftsQuery]

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
        highlight(songs_fts, 1, '<mark>', '</mark>') as highlighted_title,
        snippet(songs_fts, 3, '<mark>', '</mark>', '...', 30) as matched_content,
        songs_fts.content as full_content,
        rank as bm25_rank
      FROM songs_fts
      JOIN songs s ON s.id = songs_fts.song_id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE songs_fts MATCH ? ${categoryFilter}
      ORDER BY rank
      LIMIT 500
    `,
      )
      .all(...standardQueryParams) as Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      category_priority: number
      presentation_count: number
      highlighted_title: string
      matched_content: string
      full_content: string
      bm25_rank: number
    }>

    log('debug', `Phase 1 (standard): Found ${standardResults.length} results`)

    // Phase 2: Trigram search for fuzzy matches (use expanded terms)
    const trigramQuery = buildTrigramQuery(expandedTerms)
    let trigramResults: Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      category_priority: number
      presentation_count: number
      full_content: string
      bm25_rank: number
    }> = []

    if (trigramQuery) {
      try {
        const trigramQueryParams =
          categoryId !== undefined ? [trigramQuery, categoryId] : [trigramQuery]
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
            songs_fts_trigram.content as full_content,
            rank as bm25_rank
          FROM songs_fts_trigram
          JOIN songs s ON s.id = songs_fts_trigram.song_id
          LEFT JOIN song_categories sc ON s.category_id = sc.id
          WHERE songs_fts_trigram MATCH ? ${categoryFilter}
          ORDER BY rank
          LIMIT 200
        `,
          )
          .all(...trigramQueryParams) as typeof trigramResults

        log(
          'debug',
          `Phase 2 (trigram): Found ${trigramResults.length} results`,
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
        highlighted_title: string
        matched_content: string
        full_content: string
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
          highlighted_title: r.title, // No highlighting for trigram-only matches
          matched_content: '',
          fromTrigram: true,
        })
      }
    }

    const candidates = Array.from(candidateMap.values())
    log('debug', `Combined: ${candidates.length} unique candidates`)

    // Phase 3: Calculate match scores using phrase-based scoring
    // Title: uses calculateTitleScore (bonuses for exact phrase, term order)
    // Content: uses calculateBestPhraseScore (finds BEST matching region, not scattered words)
    // Title matches get 2x weight compared to content matches
    const TITLE_WEIGHT = 2
    const CONTENT_WEIGHT = 1

    const scoredResults = candidates.map((r) => {
      // Calculate title score (0-100) with phrase matching
      const titleScore = calculateTitleScore(r.title, expandedTerms)

      // Calculate content score (0-100) - finds the BEST single phrase match
      const contentScore = calculateBestPhraseScore(
        r.full_content,
        expandedTerms,
      )

      // Weighted combined score: title matches count 2x more than content matches
      const termScore =
        (titleScore * TITLE_WEIGHT + contentScore * CONTENT_WEIGHT) /
        (TITLE_WEIGHT + CONTENT_WEIGHT)

      // Apply category priority multiplier (default 1 for uncategorized)
      const boostedScore = termScore * r.category_priority

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

    // Return top 50 results
    const topResults = scoredResults.slice(0, 50)

    log(
      'debug',
      `Phase 3: Re-ranked. Top score: ${topResults[0]?.termScore ?? 0}%`,
    )

    return topResults.map((r) => {
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
        highlightedTitle: r.highlighted_title,
        matchedContent,
        presentationCount: r.presentation_count,
      }
    })
  } catch (error) {
    log('error', `Failed to search songs with query "${query}": ${error}`)
    return []
  }
}
