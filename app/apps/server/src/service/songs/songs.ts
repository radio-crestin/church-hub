import { getCategoryById } from './categories'
import { getSlidesBySongId } from './song-slides'
import type {
  OperationResult,
  Song,
  SongRecord,
  SongWithSlides,
  UpsertSongInput,
} from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [songs] ${message}`)
}

/**
 * Converts database song record to API format
 */
function toSong(record: SongRecord): Song {
  return {
    id: record.id,
    title: record.title,
    categoryId: record.category_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all songs
 */
export function getAllSongs(): Song[] {
  try {
    log('debug', 'Getting all songs')

    const db = getDatabase()
    const query = db.query('SELECT * FROM songs ORDER BY title ASC')
    const records = query.all() as SongRecord[]

    return records.map(toSong)
  } catch (error) {
    log('error', `Failed to get all songs: ${error}`)
    return []
  }
}

/**
 * Gets a song by ID
 */
export function getSongById(id: number): Song | null {
  try {
    log('debug', `Getting song by ID: ${id}`)

    const db = getDatabase()
    const query = db.query('SELECT * FROM songs WHERE id = ?')
    const record = query.get(id) as SongRecord | null

    if (!record) {
      log('debug', `Song not found: ${id}`)
      return null
    }

    return toSong(record)
  } catch (error) {
    log('error', `Failed to get song: ${error}`)
    return null
  }
}

/**
 * Gets a song by ID with all its slides and category
 */
export function getSongWithSlides(id: number): SongWithSlides | null {
  try {
    log('debug', `Getting song with slides: ${id}`)

    const song = getSongById(id)
    if (!song) {
      return null
    }

    const slides = getSlidesBySongId(id)
    const category = song.categoryId ? getCategoryById(song.categoryId) : null

    return {
      ...song,
      slides,
      category,
    }
  } catch (error) {
    log('error', `Failed to get song with slides: ${error}`)
    return null
  }
}

/**
 * Creates or updates a song with optional slides
 */
export function upsertSong(input: UpsertSongInput): SongWithSlides | null {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    let songId: number

    if (input.id) {
      log('debug', `Updating song: ${input.id}`)

      const query = db.query(`
        UPDATE songs
        SET title = ?, category_id = ?, updated_at = ?
        WHERE id = ?
      `)
      query.run(input.title, input.categoryId ?? null, now, input.id)
      songId = input.id

      log('info', `Song updated: ${input.id}`)
    } else {
      log('debug', `Creating song: ${input.title}`)

      const insertQuery = db.query(`
        INSERT INTO songs (title, category_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      insertQuery.run(input.title, input.categoryId ?? null, now, now)

      const getLastId = db.query('SELECT last_insert_rowid() as id')
      const result = getLastId.get() as { id: number }
      songId = result.id

      log('info', `Song created: ${songId}`)
    }

    // Handle slides if provided
    if (input.slides !== undefined) {
      log(
        'debug',
        `Processing ${input.slides.length} slides for song ${songId}`,
      )

      // Get existing slide IDs
      const existingSlides = db
        .query('SELECT id FROM song_slides WHERE song_id = ?')
        .all(songId) as { id: number }[]
      const existingIds = new Set(existingSlides.map((s) => s.id))

      // Track which existing IDs are still present
      const keepIds = new Set<number>()

      for (const slide of input.slides) {
        const isExisting =
          typeof slide.id === 'number' && existingIds.has(slide.id)

        if (isExisting) {
          // Update existing slide
          db.query(`
            UPDATE song_slides
            SET content = ?, sort_order = ?, updated_at = ?
            WHERE id = ?
          `).run(slide.content, slide.sortOrder, now, slide.id)
          keepIds.add(slide.id as number)
        } else {
          // Insert new slide
          db.query(`
            INSERT INTO song_slides (song_id, content, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(songId, slide.content, slide.sortOrder, now, now)
        }
      }

      // Delete slides that were removed
      for (const existingId of existingIds) {
        if (!keepIds.has(existingId)) {
          db.query('DELETE FROM song_slides WHERE id = ?').run(existingId)
          log('debug', `Deleted slide: ${existingId}`)
        }
      }
    }

    return getSongWithSlides(songId)
  } catch (error) {
    log('error', `Failed to upsert song: ${error}`)
    return null
  }
}

/**
 * Deletes a song and all its slides (cascading)
 */
export function deleteSong(id: number): OperationResult {
  try {
    log('debug', `Deleting song: ${id}`)

    const db = getDatabase()

    // Slides are deleted automatically via CASCADE
    const query = db.query('DELETE FROM songs WHERE id = ?')
    query.run(id)

    log('info', `Song deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete song: ${error}`)
    return { success: false, error: String(error) }
  }
}
