import type { SongSearchResult } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-search] ${message}`)
}

/**
 * Updates the FTS index for a specific song
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

    // Remove existing index entry
    const deleteQuery = db.query('DELETE FROM songs_fts WHERE song_id = ?')
    deleteQuery.run(songId)

    // Insert new index entry with category_name
    const insertQuery = db.query(`
      INSERT INTO songs_fts (song_id, title, category_name, content)
      VALUES (?, ?, ?, ?)
    `)
    insertQuery.run(
      songId,
      song.title,
      song.category_name ?? '',
      combinedContent,
    )

    log('debug', `Search index updated for song: ${songId}`)
  } catch (error) {
    log('error', `Failed to update search index: ${error}`)
  }
}

/**
 * Removes a song from the FTS index
 */
export function removeFromSearchIndex(songId: number): void {
  try {
    log('debug', `Removing song from search index: ${songId}`)

    const db = getDatabase()
    const query = db.query('DELETE FROM songs_fts WHERE song_id = ?')
    query.run(songId)

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
 * Rebuilds the entire search index using a single batch INSERT
 * This is much faster than updating each song individually
 */
export function rebuildSearchIndex(): void {
  try {
    log('info', 'Rebuilding search index...')

    const db = getDatabase()

    // Use a transaction for atomicity
    db.exec('BEGIN TRANSACTION')

    try {
      // Clear existing index
      db.exec('DELETE FROM songs_fts')

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
 * Builds an optimized FTS5 query with tiered matching
 * Supports: exact phrase, proximity (NEAR), partial AND matching, and prefix fallback
 *
 * For multi-word queries, this creates a combined query that:
 * 1. Tries exact phrase match (highest relevance)
 * 2. Tries proximity match within 5 tokens
 * 3. Tries AND queries with N-1 terms (allows one missing term)
 * 4. Tries AND queries with N-2 terms (allows two missing terms, for 5+ word queries)
 * 5. Falls back to individual prefix matches with OR
 */
function buildSearchQuery(queryText: string): string {
  // Escape special FTS5 characters
  const sanitized = queryText
    .replace(/['"]/g, '')
    .replace(/[*()^:+\-\\]/g, ' ')
    .trim()

  if (!sanitized) return ''

  const terms = sanitized.split(/\s+/).filter((t) => t.length > 0)

  if (terms.length === 0) return ''

  if (terms.length === 1) {
    // Single word: prefix match
    return `"${terms[0]}"*`
  }

  const queries: string[] = []

  // Tier 1: Exact phrase (highest rank)
  queries.push(`"${terms.join(' ')}"`)

  // Tier 2: NEAR with all terms
  queries.push(`NEAR(${terms.map((t) => `"${t}"`).join(' ')}, 5)`)

  // Tier 3: AND queries with N-1 terms (allows one missing term)
  // This is critical for partial matching - e.g., "Isus Hristos in veci va fi"
  // will match "Isus Cristos in veci va fi" because 5/6 terms match via AND
  if (terms.length >= 3) {
    for (let i = 0; i < terms.length; i++) {
      const subset = terms.filter((_, idx) => idx !== i)
      queries.push(`(${subset.map((t) => `"${t}"*`).join(' AND ')})`)
    }
  }

  // Tier 4: AND queries with N-2 terms (for 5+ word queries)
  if (terms.length >= 5) {
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const subset = terms.filter((_, idx) => idx !== i && idx !== j)
        queries.push(`(${subset.map((t) => `"${t}"*`).join(' AND ')})`)
      }
    }
  }

  // Tier 5: OR fallback for individual terms
  const prefixQuery = terms.map((t) => `"${t}"*`).join(' OR ')
  queries.push(`(${prefixQuery})`)

  // Combine with OR - FTS5's BM25 will naturally rank better matches higher
  return queries.join(' OR ')
}

/**
 * Searches songs using FTS5 with field-weighted ranking
 *
 * Ranking weights (via bm25):
 * - title: 10.0 (highest priority)
 * - category_name: 5.0 (medium priority)
 * - content: 1.0 (lowest priority)
 *
 * Query strategy prioritizes:
 * 1. Exact phrase matches
 * 2. Proximity matches (words within 5 tokens)
 * 3. Individual term prefix matches
 *
 * Performance optimizations:
 * - Uses FTS5 inverted index for fast MATCH queries
 * - Limits results to top 50 matches
 */
export function searchSongs(query: string): SongSearchResult[] {
  try {
    log('debug', `Searching songs: ${query}`)

    if (!query.trim()) {
      return []
    }

    const db = getDatabase()

    // Build the tiered FTS5 query
    const ftsQuery = buildSearchQuery(query)

    if (!ftsQuery) {
      return []
    }

    log('debug', `FTS query: ${ftsQuery}`)

    // Use bm25() with column weights: song_id(0), title(10), category_name(5), content(1)
    // snippet() column index: 0=song_id(UNINDEXED), 1=title, 2=category_name, 3=content
    // highlight() is used for title (full text with marks), snippet() for content (truncated)
    // IMPORTANT: highlight() and snippet() MUST be in same query context as MATCH clause
    const searchQuery = db.query(`
      SELECT
        s.id,
        s.title,
        s.category_id,
        sc.name as category_name,
        highlight(songs_fts, 1, '<mark>', '</mark>') as highlighted_title,
        snippet(songs_fts, 3, '<mark>', '</mark>', '...', 30) as matched_content
      FROM songs_fts
      JOIN songs s ON s.id = songs_fts.song_id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE songs_fts MATCH ?
      ORDER BY bm25(songs_fts, 0.0, 10.0, 5.0, 1.0)
      LIMIT 50
    `)

    const results = searchQuery.all(ftsQuery) as Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      highlighted_title: string
      matched_content: string
    }>

    log('debug', `Search found ${results.length} results`)

    return results.map((r) => ({
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
