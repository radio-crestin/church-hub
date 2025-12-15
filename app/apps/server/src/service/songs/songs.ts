import { getCategoryById } from './categories'
import { sanitizeSongTitle } from './sanitizeTitle'
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
const SLIDE_BULK_INSERT_CHUNK_SIZE = 500

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [songs] ${message}`)
}

interface SlideInput {
  content: string
  sortOrder: number
  label?: string | null
}

interface SlideWithSongId {
  songId: number
  content: string
  sortOrder: number
  label: string | null
}

/**
 * Bulk inserts all slides from all songs in chunks
 * This is more efficient than calling insertSlidesBulk per song
 */
function insertSlidesBulkAll(
  db: any,
  slides: SlideWithSongId[],
  now: number,
): void {
  if (slides.length === 0) return

  for (let i = 0; i < slides.length; i += SLIDE_BULK_INSERT_CHUNK_SIZE) {
    const chunk = slides.slice(i, i + SLIDE_BULK_INSERT_CHUNK_SIZE)
    const valuesSql = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const stmt = db.query(`
      INSERT INTO song_slides (song_id, content, sort_order, label, created_at, updated_at)
      VALUES ${valuesSql}
    `)

    const params: (number | string | null)[] = []
    for (const slide of chunk) {
      params.push(
        slide.songId,
        slide.content,
        slide.sortOrder,
        slide.label,
        now,
        now,
      )
    }
    stmt.run(...params)
  }
}

/**
 * Converts database song record to API format
 */
function toSong(record: SongRecord): Song {
  return {
    id: record.id,
    title: record.title,
    categoryId: record.category_id,
    sourceFilename: record.source_filename,
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
    presentationCount: record.presentation_count,
    lastManualEdit: record.last_manual_edit,
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
    const sanitizedTitle = sanitizeSongTitle(input.title)

    let songId: number

    if (input.id) {
      log('debug', `Updating song: ${input.id}`)

      // Set last_manual_edit only when isManualEdit is true (UI edit)
      const lastManualEdit = input.isManualEdit ? now : null

      const query = db.query(`
        UPDATE songs
        SET title = ?, category_id = ?, source_filename = ?,
            author = ?, copyright = ?, ccli = ?, key = ?, tempo = ?,
            time_signature = ?, theme = ?, alt_theme = ?, hymn_number = ?,
            key_line = ?, presentation_order = ?, updated_at = ?,
            last_manual_edit = COALESCE(?, last_manual_edit)
        WHERE id = ?
      `)
      query.run(
        sanitizedTitle,
        input.categoryId ?? null,
        input.sourceFilename ?? null,
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
        lastManualEdit,
        input.id,
      )
      songId = input.id

      log('info', `Song updated: ${input.id}`)
    } else {
      log('debug', `Creating song: ${sanitizedTitle}`)

      // Set last_manual_edit only when isManualEdit is true (UI edit)
      const lastManualEdit = input.isManualEdit ? now : null

      const insertQuery = db.query(`
        INSERT INTO songs (
          title, category_id, source_filename,
          author, copyright, ccli, key, tempo, time_signature,
          theme, alt_theme, hymn_number, key_line, presentation_order,
          last_manual_edit, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      insertQuery.run(
        sanitizedTitle,
        input.categoryId ?? null,
        input.sourceFilename ?? null,
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
        lastManualEdit,
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
 * Optimized for high performance with:
 * - UPSERT (INSERT ... ON CONFLICT) for single-statement insert/update
 * - Bulk slide deletion in single query
 * - Bulk slide insertion in chunks
 */
export function batchImportSongs(
  songs: BatchImportSongInput[],
  defaultCategoryId?: number | null,
  overwriteDuplicates?: boolean,
  skipManuallyEdited?: boolean,
): BatchImportResult {
  const db = getDatabase()
  const songIds: number[] = []
  let successCount = 0
  let failedCount = 0
  let skippedCount = 0
  const errors: string[] = []
  const now = Math.floor(Date.now() / 1000)

  log('info', `Starting batch import of ${songs.length} songs`)

  try {
    // Use transaction for atomic batch insert
    db.exec('BEGIN TRANSACTION')

    // Prepare UPSERT statement - combines INSERT and UPDATE in one operation
    // Uses ON CONFLICT with the UNIQUE constraint on title (COLLATE NOCASE)
    // RETURNING id gives us the song ID whether inserted or updated
    const upsertSongStmt = overwriteDuplicates
      ? db.query(`
          INSERT INTO songs (
            title, category_id, source_filename,
            author, copyright, ccli, key, tempo, time_signature,
            theme, alt_theme, hymn_number, key_line, presentation_order,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(title) DO UPDATE SET
            category_id = excluded.category_id,
            source_filename = excluded.source_filename,
            author = excluded.author,
            copyright = excluded.copyright,
            ccli = excluded.ccli,
            key = excluded.key,
            tempo = excluded.tempo,
            time_signature = excluded.time_signature,
            theme = excluded.theme,
            alt_theme = excluded.alt_theme,
            hymn_number = excluded.hymn_number,
            key_line = excluded.key_line,
            presentation_order = excluded.presentation_order,
            updated_at = excluded.updated_at
          RETURNING id
        `)
      : db.query(`
          INSERT INTO songs (
            title, category_id, source_filename,
            author, copyright, ccli, key, tempo, time_signature,
            theme, alt_theme, hymn_number, key_line, presentation_order,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(title) DO NOTHING
          RETURNING id
        `)

    // Collect all song IDs and their slides for batch processing
    const songsWithIds: Array<{
      songId: number
      slides: SlideInput[]
    }> = []

    // Prepare statement to check for manually edited songs (used when skipManuallyEdited is enabled)
    const checkManualEditStmt =
      skipManuallyEdited && overwriteDuplicates
        ? db.query(
            'SELECT id, last_manual_edit FROM songs WHERE LOWER(title) = LOWER(?)',
          )
        : null

    // Phase 1: Insert/Update all songs and collect IDs
    for (let i = 0; i < songs.length; i++) {
      const input = songs[i]

      try {
        const categoryId = input.categoryId ?? defaultCategoryId ?? null
        const sanitizedTitle = sanitizeSongTitle(input.title)

        // Check if song was manually edited and should be skipped
        if (checkManualEditStmt) {
          const existing = checkManualEditStmt.get(sanitizedTitle) as {
            id: number
            last_manual_edit: number | null
          } | null
          if (existing?.last_manual_edit) {
            skippedCount++
            errors.push(`Song "${input.title}": manually edited (skipped)`)
            continue
          }
        }

        const result = upsertSongStmt.get(
          sanitizedTitle,
          categoryId,
          input.sourceFilename ?? null,
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
        ) as { id: number } | null

        if (result) {
          songIds.push(result.id)
          songsWithIds.push({ songId: result.id, slides: input.slides || [] })
          successCount++
        } else {
          // DO NOTHING was triggered (duplicate without overwrite)
          failedCount++
          errors.push(`Song "${input.title}": duplicate title (skipped)`)
        }
      } catch (error) {
        failedCount++
        const msg = error instanceof Error ? error.message : String(error)
        errors.push(`Song "${input.title}": ${msg}`)
        log('error', `Failed to import song ${i + 1}: ${msg}`)
      }
    }

    // Phase 2: Bulk delete old slides for all imported songs (when overwriting)
    if (overwriteDuplicates && songIds.length > 0) {
      const placeholders = songIds.map(() => '?').join(',')
      db.query(
        `DELETE FROM song_slides WHERE song_id IN (${placeholders})`,
      ).run(...songIds)
    }

    // Phase 3: Bulk insert all slides at once (super batch)
    const allSlides: Array<{
      songId: number
      content: string
      sortOrder: number
      label: string | null
    }> = []

    for (const { songId, slides } of songsWithIds) {
      for (const slide of slides) {
        allSlides.push({
          songId,
          content: slide.content,
          sortOrder: slide.sortOrder,
          label: slide.label ?? null,
        })
      }
    }

    if (allSlides.length > 0) {
      insertSlidesBulkAll(db, allSlides, now)
    }

    db.exec('COMMIT')
    log(
      'info',
      `Batch import completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`,
    )
  } catch (error) {
    db.exec('ROLLBACK')
    const msg = error instanceof Error ? error.message : String(error)
    log('error', `Batch import transaction failed: ${msg}`)
    errors.push(`Transaction failed: ${msg}`)
  }

  return { successCount, failedCount, skippedCount, songIds, errors }
}
