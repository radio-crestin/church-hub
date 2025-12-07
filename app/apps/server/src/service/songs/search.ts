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

    // Get song title
    const songQuery = db.query('SELECT title FROM songs WHERE id = ?')
    const song = songQuery.get(songId) as { title: string } | null

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

    // Insert new index entry
    const insertQuery = db.query(`
      INSERT INTO songs_fts (song_id, title, content)
      VALUES (?, ?, ?)
    `)
    insertQuery.run(songId, song.title, combinedContent)

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
 * Rebuilds the entire search index
 */
export function rebuildSearchIndex(): void {
  try {
    log('info', 'Rebuilding search index...')

    const db = getDatabase()

    // Clear existing index
    db.exec('DELETE FROM songs_fts')

    // Get all songs with their slides
    const songsQuery = db.query('SELECT id FROM songs')
    const songs = songsQuery.all() as { id: number }[]

    for (const song of songs) {
      updateSearchIndex(song.id)
    }

    log('info', `Search index rebuilt: ${songs.length} songs indexed`)
  } catch (error) {
    log('error', `Failed to rebuild search index: ${error}`)
  }
}

/**
 * Searches songs using FTS5
 */
export function searchSongs(query: string): SongSearchResult[] {
  try {
    log('debug', `Searching songs: ${query}`)

    if (!query.trim()) {
      return []
    }

    const db = getDatabase()

    // Use FTS5 MATCH query with snippet for highlighting
    const searchQuery = db.query(`
      SELECT
        s.id,
        s.title,
        s.category_id,
        sc.name as category_name,
        snippet(songs_fts, 2, '<mark>', '</mark>', '...', 30) as matched_content
      FROM songs_fts fts
      JOIN songs s ON fts.song_id = s.id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE songs_fts MATCH ?
      ORDER BY rank
      LIMIT 50
    `)

    // Escape special FTS5 characters and add prefix matching
    // FTS5 special chars: " ' * ( ) ^ : + - \ need to be removed or replaced
    const escapedQuery = query
      .replace(/['"]/g, '')
      .replace(/[*()^:+\-\\]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `"${term}"*`)
      .join(' OR ')

    if (!escapedQuery) {
      return []
    }

    const results = searchQuery.all(escapedQuery) as Array<{
      id: number
      title: string
      category_id: number | null
      category_name: string | null
      matched_content: string
    }>

    log('debug', `Search found ${results.length} results`)

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      categoryId: r.category_id,
      categoryName: r.category_name,
      matchedContent: r.matched_content,
    }))
  } catch (error) {
    log('error', `Failed to search songs with query "${query}": ${error}`)
    return []
  }
}
