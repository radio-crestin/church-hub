import type {
  OperationResult,
  ReorderSongSlidesInput,
  SongSlide,
  SongSlideRecord,
  UpsertSongSlideInput,
} from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-slides] ${message}`)
}

/**
 * Converts database slide record to API format
 */
function toSongSlide(record: SongSlideRecord): SongSlide {
  return {
    id: record.id,
    songId: record.song_id,
    content: record.content,
    sortOrder: record.sort_order,
    label: record.label,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all slides for a song
 */
export function getSlidesBySongId(songId: number): SongSlide[] {
  try {
    log('debug', `Getting slides for song: ${songId}`)

    const db = getDatabase()
    const query = db.query(
      'SELECT * FROM song_slides WHERE song_id = ? ORDER BY sort_order ASC',
    )
    const records = query.all(songId) as SongSlideRecord[]

    return records.map(toSongSlide)
  } catch (error) {
    log('error', `Failed to get slides: ${error}`)
    return []
  }
}

/**
 * Gets a slide by ID
 */
export function getSongSlideById(id: number): SongSlide | null {
  try {
    log('debug', `Getting song slide by ID: ${id}`)

    const db = getDatabase()
    const query = db.query('SELECT * FROM song_slides WHERE id = ?')
    const record = query.get(id) as SongSlideRecord | null

    if (!record) {
      log('debug', `Song slide not found: ${id}`)
      return null
    }

    return toSongSlide(record)
  } catch (error) {
    log('error', `Failed to get song slide: ${error}`)
    return null
  }
}

/**
 * Gets the next sort order for a song
 */
function getNextSortOrder(songId: number): number {
  const db = getDatabase()
  const query = db.query(
    'SELECT MAX(sort_order) as max_order FROM song_slides WHERE song_id = ?',
  )
  const result = query.get(songId) as { max_order: number | null }
  return (result.max_order ?? -1) + 1
}

/**
 * Creates or updates a song slide
 */
export function upsertSongSlide(input: UpsertSongSlideInput): SongSlide | null {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    if (input.id) {
      log('debug', `Updating song slide: ${input.id}`)

      const query = db.query(`
        UPDATE song_slides
        SET content = ?, label = ?, updated_at = ?
        WHERE id = ?
      `)
      query.run(input.content, input.label ?? null, now, input.id)

      log('info', `Song slide updated: ${input.id}`)
      return getSongSlideById(input.id)
    }

    log('debug', `Creating song slide for song: ${input.songId}`)

    const sortOrder = input.sortOrder ?? getNextSortOrder(input.songId)

    const insertQuery = db.query(`
      INSERT INTO song_slides (song_id, content, sort_order, label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    insertQuery.run(
      input.songId,
      input.content,
      sortOrder,
      input.label ?? null,
      now,
      now,
    )

    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id } = getLastId.get() as { id: number }

    log('info', `Song slide created: ${id}`)
    return getSongSlideById(id)
  } catch (error) {
    log('error', `Failed to upsert song slide: ${error}`)
    return null
  }
}

/**
 * Deletes a song slide
 */
export function deleteSongSlide(id: number): OperationResult {
  try {
    log('debug', `Deleting song slide: ${id}`)

    const db = getDatabase()
    const query = db.query('DELETE FROM song_slides WHERE id = ?')
    query.run(id)

    log('info', `Song slide deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete song slide: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Clones a song slide
 */
export function cloneSongSlide(id: number): SongSlide | null {
  try {
    log('debug', `Cloning song slide: ${id}`)

    const original = getSongSlideById(id)
    if (!original) {
      log('error', `Original slide not found: ${id}`)
      return null
    }

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const sortOrder = original.sortOrder + 1

    // Shift all slides after the original one
    const shiftQuery = db.query(`
      UPDATE song_slides
      SET sort_order = sort_order + 1, updated_at = ?
      WHERE song_id = ? AND sort_order > ?
    `)
    shiftQuery.run(now, original.songId, original.sortOrder)

    // Insert the cloned slide
    const insertQuery = db.query(`
      INSERT INTO song_slides (song_id, content, sort_order, label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    insertQuery.run(
      original.songId,
      original.content,
      sortOrder,
      original.label,
      now,
      now,
    )

    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id: newId } = getLastId.get() as { id: number }

    log('info', `Song slide cloned: ${id} -> ${newId}`)
    return getSongSlideById(newId)
  } catch (error) {
    log('error', `Failed to clone song slide: ${error}`)
    return null
  }
}

/**
 * Reorders slides within a song
 */
export function reorderSongSlides(
  songId: number,
  input: ReorderSongSlidesInput,
): OperationResult {
  try {
    log('debug', `Reordering slides for song: ${songId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    const updateQuery = db.query(`
      UPDATE song_slides
      SET sort_order = ?, updated_at = ?
      WHERE id = ? AND song_id = ?
    `)

    for (let i = 0; i < input.slideIds.length; i++) {
      updateQuery.run(i, now, input.slideIds[i], songId)
    }

    log('info', `Slides reordered for song: ${songId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to reorder slides: ${error}`)
    return { success: false, error: String(error) }
  }
}
