import type { SongSearchResult } from './types'
import { getDatabase } from '../../db'

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

    const db = getDatabase()

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

    const db = getDatabase()
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

    const db = getDatabase()
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
 * Rebuilds the entire search index (both standard and trigram)
 * This is much faster than updating each song individually
 */
export function rebuildSearchIndex(): void {
  try {
    log('info', 'Rebuilding search index...')

    const db = getDatabase()

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
 * Checks if a term has a fuzzy match in content
 * Uses middle substring matching (e.g., "Hristos" matches "Cristos" via "risto")
 * Minimum substring length is 4 to avoid false positives (e.g., "ist" matching "Linistit")
 */
function hasFuzzyMatch(term: string, content: string): boolean {
  // First check exact match
  if (content.includes(term)) {
    return true
  }

  // For short terms, only exact match
  if (term.length < 5) {
    return false
  }

  // Check middle substrings for fuzzy match
  // "Hristos" -> check "risto", "isto" which would match "Cristos"
  // Minimum length 4 to avoid false positives like "ist" matching "Linistit"
  for (let len = Math.min(5, term.length - 1); len >= 4; len--) {
    for (let start = 1; start <= term.length - len; start++) {
      const sub = term.substring(start, start + len)
      if (content.includes(sub)) {
        return true
      }
    }
  }

  return false
}

/**
 * Calculates a relevance score based on how many query terms match the content
 * Uses fuzzy substring matching for better results with spelling variations
 * Higher score = more terms matched = better relevance
 */
function calculateTermMatchScore(
  content: string,
  queryTerms: string[],
): number {
  const normalizedContent = content.toLowerCase()
  let matchedCount = 0

  for (const term of queryTerms) {
    if (hasFuzzyMatch(term, normalizedContent)) {
      matchedCount++
    }
  }

  // Return percentage of terms matched (0-100)
  return queryTerms.length > 0
    ? Math.round((matchedCount / queryTerms.length) * 100)
    : 0
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
 */
export function searchSongs(query: string): SongSearchResult[] {
  try {
    log('debug', `Searching songs: ${query}`)

    if (!query.trim()) {
      return []
    }

    const db = getDatabase()
    const queryTerms = extractSearchTerms(query)
    const ftsQuery = buildSearchQuery(query)

    if (!ftsQuery) {
      return []
    }

    log('debug', `FTS query: ${ftsQuery}`)
    log('debug', `Query terms: ${queryTerms.join(', ')}`)

    // Phase 1: Standard FTS5 search for exact/prefix matches
    const standardResults = db
      .query(
        `
      SELECT
        s.id,
        s.title,
        s.category_id,
        sc.name as category_name,
        COALESCE(sc.priority, 1) as category_priority,
        highlight(songs_fts, 1, '<mark>', '</mark>') as highlighted_title,
        snippet(songs_fts, 3, '<mark>', '</mark>', '...', 30) as matched_content,
        songs_fts.content as full_content,
        rank as bm25_rank
      FROM songs_fts
      JOIN songs s ON s.id = songs_fts.song_id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE songs_fts MATCH ?
      ORDER BY rank
      LIMIT 100
    `,
      )
      .all(ftsQuery) as Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      category_priority: number
      highlighted_title: string
      matched_content: string
      full_content: string
      bm25_rank: number
    }>

    log('debug', `Phase 1 (standard): Found ${standardResults.length} results`)

    // Phase 2: Trigram search for fuzzy matches
    const trigramQuery = buildTrigramQuery(queryTerms)
    let trigramResults: Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      category_priority: number
      full_content: string
      bm25_rank: number
    }> = []

    if (trigramQuery) {
      try {
        trigramResults = db
          .query(
            `
          SELECT
            s.id,
            s.title,
            s.category_id,
            sc.name as category_name,
            COALESCE(sc.priority, 1) as category_priority,
            songs_fts_trigram.content as full_content,
            rank as bm25_rank
          FROM songs_fts_trigram
          JOIN songs s ON s.id = songs_fts_trigram.song_id
          LEFT JOIN song_categories sc ON s.category_id = sc.id
          WHERE songs_fts_trigram MATCH ?
          ORDER BY rank
          LIMIT 200
        `,
          )
          .all(trigramQuery) as typeof trigramResults

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

    // Phase 3: Calculate term match scores and re-rank with category priority
    const scoredResults = candidates.map((r) => {
      const searchableText = `${r.title} ${r.full_content}`
      const termScore = calculateTermMatchScore(searchableText, queryTerms)

      // Apply category priority multiplier (default 1 for uncategorized)
      const boostedScore = termScore * r.category_priority

      return {
        ...r,
        termScore,
        boostedScore,
      }
    })

    // Sort by: boosted score (desc), term score (desc), FTS over trigram, then BM25 rank (asc)
    scoredResults.sort((a, b) => {
      // Primary: boosted score (category priority applied)
      if (b.boostedScore !== a.boostedScore) {
        return b.boostedScore - a.boostedScore
      }
      // Secondary: more terms matched = higher priority
      if (b.termScore !== a.termScore) {
        return b.termScore - a.termScore
      }
      // Tertiary: prioritize FTS results over trigram results
      // (trigram BM25 scores are not comparable to FTS scores)
      if (a.fromTrigram !== b.fromTrigram) {
        return a.fromTrigram ? 1 : -1 // FTS (false) comes before trigram (true)
      }
      // Quaternary: better BM25 score (lower rank value = better match)
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
      const matchedContent = createFuzzyHighlightedSnippet(
        r.full_content,
        queryTerms,
      )

      return {
        id: r.id,
        title: r.title,
        categoryId: r.category_id,
        categoryName: r.category_name,
        highlightedTitle: r.highlighted_title,
        matchedContent,
      }
    })
  } catch (error) {
    log('error', `Failed to search songs with query "${query}": ${error}`)
    return []
  }
}
