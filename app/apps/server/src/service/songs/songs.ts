import { getCategoryById } from './categories'
import { getSlidesBySongId } from './song-slides'
import type {
  BatchImportResult,
  BatchImportSongInput,
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
    sourceFilePath: record.source_file_path,
    author: record.author,
    copyright: record.copyright,
    ccli: record.ccli,
    key: record.key,
    tempo: record.tempo,
    timeSignature: record.time_signature,
    theme: record.theme,
    altTheme: record.alt_theme,
    hymnNumber: record.hymn_number,
    keyLine: record.key_line,
    presentationOrder: record.presentation_order,
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
 * Gets all songs with their slides and categories
 * Optionally filters by category ID
 */
export function getAllSongsWithSlides(
  categoryId?: number | null,
): SongWithSlides[] {
  try {
    log('debug', `Getting all songs with slides, categoryId: ${categoryId}`)

    const db = getDatabase()

    let query: ReturnType<typeof db.query>
    if (categoryId !== null && categoryId !== undefined) {
      query = db.query(
        'SELECT * FROM songs WHERE category_id = ? ORDER BY title ASC',
      )
      const records = query.all(categoryId) as SongRecord[]
      return records.map((record) => {
        const song = toSong(record)
        const slides = getSlidesBySongId(song.id)
        const category = song.categoryId
          ? getCategoryById(song.categoryId)
          : null
        return { ...song, slides, category }
      })
    }

    query = db.query('SELECT * FROM songs ORDER BY title ASC')
    const records = query.all() as SongRecord[]
    return records.map((record) => {
      const song = toSong(record)
      const slides = getSlidesBySongId(song.id)
      const category = song.categoryId ? getCategoryById(song.categoryId) : null
      return { ...song, slides, category }
    })
  } catch (error) {
    log('error', `Failed to get all songs with slides: ${error}`)
    return []
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
        SET title = ?, category_id = ?, source_file_path = ?,
            author = ?, copyright = ?, ccli = ?, key = ?, tempo = ?,
            time_signature = ?, theme = ?, alt_theme = ?, hymn_number = ?,
            key_line = ?, presentation_order = ?, updated_at = ?
        WHERE id = ?
      `)
      query.run(
        input.title,
        input.categoryId ?? null,
        input.sourceFilePath ?? null,
        input.author ?? null,
        input.copyright ?? null,
        input.ccli ?? null,
        input.key ?? null,
        input.tempo ?? null,
        input.timeSignature ?? null,
        input.theme ?? null,
        input.altTheme ?? null,
        input.hymnNumber ?? null,
        input.keyLine ?? null,
        input.presentationOrder ?? null,
        now,
        input.id,
      )
      songId = input.id

      log('info', `Song updated: ${input.id}`)
    } else {
      log('debug', `Creating song: ${input.title}`)

      const insertQuery = db.query(`
        INSERT INTO songs (
          title, category_id, source_file_path,
          author, copyright, ccli, key, tempo, time_signature,
          theme, alt_theme, hymn_number, key_line, presentation_order,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      insertQuery.run(
        input.title,
        input.categoryId ?? null,
        input.sourceFilePath ?? null,
        input.author ?? null,
        input.copyright ?? null,
        input.ccli ?? null,
        input.key ?? null,
        input.tempo ?? null,
        input.timeSignature ?? null,
        input.theme ?? null,
        input.altTheme ?? null,
        input.hymnNumber ?? null,
        input.keyLine ?? null,
        input.presentationOrder ?? null,
        now,
        now,
      )

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
            SET content = ?, sort_order = ?, label = ?, updated_at = ?
            WHERE id = ?
          `).run(
            slide.content,
            slide.sortOrder,
            slide.label ?? null,
            now,
            slide.id,
          )
          keepIds.add(slide.id as number)
        } else {
          // Insert new slide
          db.query(`
            INSERT INTO song_slides (song_id, content, sort_order, label, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            songId,
            slide.content,
            slide.sortOrder,
            slide.label ?? null,
            now,
            now,
          )
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

/**
 * Batch imports multiple songs in a single transaction
 * Much faster than individual upserts for large imports
 */
export function batchImportSongs(
  songs: BatchImportSongInput[],
  defaultCategoryId?: number | null,
  overwriteDuplicates?: boolean,
): BatchImportResult {
  const db = getDatabase()
  const songIds: number[] = []
  let successCount = 0
  let failedCount = 0
  const errors: string[] = []
  const now = Math.floor(Date.now() / 1000)

  log('info', `Starting batch import of ${songs.length} songs`)

  try {
    // Use transaction for atomic batch insert
    db.exec('BEGIN TRANSACTION')

    // Prepare statements for reuse
    const findExistingStmt = db.query(
      'SELECT id FROM songs WHERE LOWER(title) = LOWER(?) LIMIT 1',
    )

    const insertSongStmt = db.query(`
      INSERT INTO songs (
        title, category_id, source_file_path,
        author, copyright, ccli, key, tempo, time_signature,
        theme, alt_theme, hymn_number, key_line, presentation_order,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const updateSongStmt = db.query(`
      UPDATE songs
      SET title = ?, category_id = ?, source_file_path = ?,
          author = ?, copyright = ?, ccli = ?, key = ?, tempo = ?,
          time_signature = ?, theme = ?, alt_theme = ?, hymn_number = ?,
          key_line = ?, presentation_order = ?, updated_at = ?
      WHERE id = ?
    `)

    const getLastIdStmt = db.query('SELECT last_insert_rowid() as id')

    const deleteSlidesByIdStmt = db.query(
      'DELETE FROM song_slides WHERE song_id = ?',
    )

    const insertSlideStmt = db.query(`
      INSERT INTO song_slides (song_id, content, sort_order, label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    for (let i = 0; i < songs.length; i++) {
      const input = songs[i]

      try {
        const categoryId = input.categoryId ?? defaultCategoryId ?? null
        let songId: number

        // Check for existing song if overwrite is enabled
        const existingSong = overwriteDuplicates
          ? (findExistingStmt.get(input.title) as { id: number } | null)
          : null

        if (existingSong) {
          // Update existing song
          songId = existingSong.id
          updateSongStmt.run(
            input.title,
            categoryId,
            input.sourceFilePath ?? null,
            input.author ?? null,
            input.copyright ?? null,
            input.ccli ?? null,
            input.key ?? null,
            input.tempo ?? null,
            input.timeSignature ?? null,
            input.theme ?? null,
            input.altTheme ?? null,
            input.hymnNumber ?? null,
            input.keyLine ?? null,
            input.presentationOrder ?? null,
            now,
            songId,
          )

          // Delete old slides before inserting new ones
          deleteSlidesByIdStmt.run(songId)
          log('debug', `Updated existing song ${songId}: "${input.title}"`)
        } else {
          // Insert new song
          insertSongStmt.run(
            input.title,
            categoryId,
            input.sourceFilePath ?? null,
            input.author ?? null,
            input.copyright ?? null,
            input.ccli ?? null,
            input.key ?? null,
            input.tempo ?? null,
            input.timeSignature ?? null,
            input.theme ?? null,
            input.altTheme ?? null,
            input.hymnNumber ?? null,
            input.keyLine ?? null,
            input.presentationOrder ?? null,
            now,
            now,
          )

          const result = getLastIdStmt.get() as { id: number }
          songId = result.id
        }

        songIds.push(songId)

        // Insert slides if provided
        if (input.slides && input.slides.length > 0) {
          for (const slide of input.slides) {
            insertSlideStmt.run(
              songId,
              slide.content,
              slide.sortOrder,
              slide.label ?? null,
              now,
              now,
            )
          }
        }

        successCount++
        log('debug', `Song ${i + 1}/${songs.length} imported: ${songId}`)
      } catch (error) {
        failedCount++
        const msg = error instanceof Error ? error.message : String(error)
        errors.push(`Song "${input.title}": ${msg}`)
        log('error', `Failed to import song ${i + 1}: ${msg}`)
      }
    }

    db.exec('COMMIT')
    log(
      'info',
      `Batch import completed: ${successCount} success, ${failedCount} failed`,
    )
  } catch (error) {
    db.exec('ROLLBACK')
    const msg = error instanceof Error ? error.message : String(error)
    log('error', `Batch import transaction failed: ${msg}`)
    errors.push(`Transaction failed: ${msg}`)
  }

  return { successCount, failedCount, songIds, errors }
}
