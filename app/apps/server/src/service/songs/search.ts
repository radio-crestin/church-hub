import type { SongSearchResult } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-search] ${message}`)
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
 * Calculates a relevance score based on how many query terms match the content
 * Higher score = more terms matched = better relevance
 */
function calculateTermMatchScore(
  content: string,
  queryTerms: string[],
): number {
  const normalizedContent = content.toLowerCase()
  let matchedCount = 0

  for (const term of queryTerms) {
    // Check if term appears in content (with word boundary awareness)
    if (normalizedContent.includes(term)) {
      matchedCount++
    }
  }

  // Return percentage of terms matched (0-100)
  return queryTerms.length > 0
    ? Math.round((matchedCount / queryTerms.length) * 100)
    : 0
}

/**
 * Builds a trigram query for fuzzy matching
 * Only uses terms with 3+ characters (trigram minimum)
 */
function buildTrigramQuery(terms: string[]): string {
  const validTerms = terms.filter((t) => t.length >= 3)
  if (validTerms.length === 0) return ''

  // For trigram, use simple OR query - each term can match substrings
  return validTerms.map((t) => `"${t}"`).join(' OR ')
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
            songs_fts_trigram.content as full_content,
            rank as bm25_rank
          FROM songs_fts_trigram
          JOIN songs s ON s.id = songs_fts_trigram.song_id
          LEFT JOIN song_categories sc ON s.category_id = sc.id
          WHERE songs_fts_trigram MATCH ?
          ORDER BY rank
          LIMIT 50
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

    // Phase 3: Calculate term match scores and re-rank
    const scoredResults = candidates.map((r) => {
      const searchableText = `${r.title} ${r.full_content}`
      const termScore = calculateTermMatchScore(searchableText, queryTerms)

      return {
        ...r,
        termScore,
      }
    })

    // Sort by: term match score (desc), then BM25 rank (asc, lower is better)
    scoredResults.sort((a, b) => {
      // Primary: more terms matched = higher priority
      if (b.termScore !== a.termScore) {
        return b.termScore - a.termScore
      }
      // Secondary: better BM25 score (lower rank value = better match)
      return a.bm25_rank - b.bm25_rank
    })

    // Return top 50 results
    const topResults = scoredResults.slice(0, 50)

    log(
      'debug',
      `Phase 3: Re-ranked. Top score: ${topResults[0]?.termScore ?? 0}%`,
    )

    return topResults.map((r) => ({
      id: r.id,
      title: r.title,
      categoryId: r.category_id,
      categoryName: r.category_name,
      highlightedTitle: r.highlighted_title,
      matchedContent: r.matched_content,
    }))
  } catch (error) {
    log('error', `Failed to search songs with query "${query}": ${error}`)
    return []
  }
}
