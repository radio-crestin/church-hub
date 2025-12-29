import { asc, eq, inArray } from 'drizzle-orm'

import { getCategoryById } from './categories'
import { sanitizeSongTitle } from './sanitizeTitle'
import { getSlidesBySongId } from './song-slides'
import type {
  BatchImportResult,
  BatchImportSongInput,
  OperationResult,
  Song,
  SongWithSlides,
  UpsertSongInput,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { songSlides, songs } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'
const SLIDE_BULK_INSERT_CHUNK_SIZE = 1000 // Increased from 500 for better performance

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
 * Uses raw SQL for performance
 */
function insertSlidesBulkAll(
  rawDb: ReturnType<typeof getRawDatabase>,
  slides: SlideWithSongId[],
  now: number,
): void {
  if (slides.length === 0) return

  for (let i = 0; i < slides.length; i += SLIDE_BULK_INSERT_CHUNK_SIZE) {
    const chunk = slides.slice(i, i + SLIDE_BULK_INSERT_CHUNK_SIZE)
    const valuesSql = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const stmt = rawDb.query(`
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
function toSong(record: typeof songs.$inferSelect): Song {
  return {
    id: record.id,
    title: record.title,
    categoryId: record.categoryId,
    sourceFilename: record.sourceFilename,
    author: record.author,
    copyright: record.copyright,
    ccli: record.ccli,
    key: record.key,
    tempo: record.tempo,
    timeSignature: record.timeSignature,
    theme: record.theme,
    altTheme: record.altTheme,
    hymnNumber: record.hymnNumber,
    keyLine: record.keyLine,
    presentationOrder: record.presentationOrder,
    presentationCount: record.presentationCount,
    lastManualEdit: record.lastManualEdit
      ? Math.floor(record.lastManualEdit.getTime() / 1000)
      : null,
    createdAt: Math.floor(record.createdAt.getTime() / 1000),
    updatedAt: Math.floor(record.updatedAt.getTime() / 1000),
  }
}

/**
 * Gets all songs
 */
export function getAllSongs(): Song[] {
  try {
    log('debug', 'Getting all songs')

    const db = getDatabase()
    const records = db.select().from(songs).orderBy(asc(songs.title)).all()

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
    const record = db.select().from(songs).where(eq(songs.id, id)).get()

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

    let records: (typeof songs.$inferSelect)[]
    if (categoryId !== null && categoryId !== undefined) {
      records = db
        .select()
        .from(songs)
        .where(eq(songs.categoryId, categoryId))
        .orderBy(asc(songs.title))
        .all()
    } else {
      records = db.select().from(songs).orderBy(asc(songs.title)).all()
    }

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
    const now = new Date()
    const sanitizedTitle = sanitizeSongTitle(input.title)

    let songId: number

    if (input.id) {
      log('debug', `Updating song: ${input.id}`)

      // Build update object
      const updateData: Record<string, any> = {
        title: sanitizedTitle,
        categoryId: input.categoryId ?? null,
        sourceFilename: input.sourceFilename ?? null,
        author: input.author ?? null,
        copyright: input.copyright ?? null,
        ccli: input.ccli ?? null,
        key: input.key ?? null,
        tempo: input.tempo ?? null,
        timeSignature: input.timeSignature ?? null,
        theme: input.theme ?? null,
        altTheme: input.altTheme ?? null,
        hymnNumber: input.hymnNumber ?? null,
        keyLine: input.keyLine ?? null,
        presentationOrder: input.presentationOrder ?? null,
        updatedAt: now,
      }

      // Set last_manual_edit only when isManualEdit is true (UI edit)
      if (input.isManualEdit) {
        updateData.lastManualEdit = now
      }

      db.update(songs).set(updateData).where(eq(songs.id, input.id)).run()
      songId = input.id

      log('info', `Song updated: ${input.id}`)
    } else {
      log('debug', `Creating song: ${sanitizedTitle}`)

      // Set last_manual_edit only when isManualEdit is true (UI edit)
      const lastManualEdit = input.isManualEdit ? now : null

      const result = db
        .insert(songs)
        .values({
          title: sanitizedTitle,
          categoryId: input.categoryId ?? null,
          sourceFilename: input.sourceFilename ?? null,
          author: input.author ?? null,
          copyright: input.copyright ?? null,
          ccli: input.ccli ?? null,
          key: input.key ?? null,
          tempo: input.tempo ?? null,
          timeSignature: input.timeSignature ?? null,
          theme: input.theme ?? null,
          altTheme: input.altTheme ?? null,
          hymnNumber: input.hymnNumber ?? null,
          keyLine: input.keyLine ?? null,
          presentationOrder: input.presentationOrder ?? null,
          lastManualEdit,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: songs.id })
        .get()

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
        .select({ id: songSlides.id })
        .from(songSlides)
        .where(eq(songSlides.songId, songId))
        .all()
      const existingIds = new Set(existingSlides.map((s) => s.id))

      // Track which existing IDs are still present
      const keepIds = new Set<number>()

      for (const slide of input.slides) {
        const isExisting =
          typeof slide.id === 'number' && existingIds.has(slide.id)

        if (isExisting) {
          // Update existing slide
          db.update(songSlides)
            .set({
              content: slide.content,
              sortOrder: slide.sortOrder,
              label: slide.label ?? null,
              updatedAt: now,
            })
            .where(eq(songSlides.id, slide.id as number))
            .run()
          keepIds.add(slide.id as number)
        } else {
          // Insert new slide
          db.insert(songSlides)
            .values({
              songId,
              content: slide.content,
              sortOrder: slide.sortOrder,
              label: slide.label ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .run()
        }
      }

      // Delete slides that were removed
      const idsToDelete = Array.from(existingIds).filter(
        (id) => !keepIds.has(id),
      )
      if (idsToDelete.length > 0) {
        db.delete(songSlides).where(inArray(songSlides.id, idsToDelete)).run()
        log('debug', `Deleted ${idsToDelete.length} slides`)
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
    db.delete(songs).where(eq(songs.id, id)).run()

    log('info', `Song deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete song: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Deletes multiple songs by their IDs in a single query
 */
export function deleteSongsByIds(
  ids: number[],
): OperationResult & { deletedCount: number } {
  try {
    if (ids.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    log('debug', `Deleting ${ids.length} songs`)

    const db = getDatabase()

    // Slides are deleted automatically via CASCADE
    const result = db.delete(songs).where(inArray(songs.id, ids)).run()

    log('info', `Songs deleted: ${result.changes}`)
    return { success: true, deletedCount: result.changes }
  } catch (error) {
    log('error', `Failed to delete songs: ${error}`)
    return { success: false, error: String(error), deletedCount: 0 }
  }
}

/**
 * Batch imports multiple songs in a single transaction
 * Optimized for high performance with:
 * - UPSERT (INSERT ... ON CONFLICT) for single-statement insert/update
 * - Bulk slide deletion in single query
 * - Bulk slide insertion in chunks
 * Uses raw SQL for performance
 */
export function batchImportSongs(
  songsInput: BatchImportSongInput[],
  defaultCategoryId?: number | null,
  overwriteDuplicates?: boolean,
  skipManuallyEdited?: boolean,
): BatchImportResult {
  const rawDb = getRawDatabase()
  const songIds: number[] = []
  let successCount = 0
  let failedCount = 0
  let skippedCount = 0
  const errors: string[] = []
  const now = Math.floor(Date.now() / 1000)

  const totalStart = performance.now()
  log('info', `Starting batch import of ${songsInput.length} songs`)

  try {
    // Use transaction for atomic batch insert
    rawDb.exec('BEGIN TRANSACTION')

    // Prepare UPSERT statement - combines INSERT and UPDATE in one operation
    // Uses ON CONFLICT with the UNIQUE constraint on title (COLLATE NOCASE)
    // RETURNING id gives us the song ID whether inserted or updated
    const upsertSongStmt = overwriteDuplicates
      ? rawDb.query(`
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
      : rawDb.query(`
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

    // OPTIMIZATION: Batch load all manually edited songs at once instead of checking one by one
    // This reduces N queries to 1 query for the manual edit check
    let manuallyEditedTitles: Set<string> | null = null
    if (skipManuallyEdited && overwriteDuplicates) {
      const manualEditStart = performance.now()
      const manuallyEditedSongs = rawDb
        .query(
          'SELECT LOWER(title) as lower_title FROM songs WHERE last_manual_edit IS NOT NULL',
        )
        .all() as { lower_title: string }[]
      manuallyEditedTitles = new Set(
        manuallyEditedSongs.map((s) => s.lower_title),
      )
      const manualEditTime = performance.now() - manualEditStart
      log(
        'info',
        `[PERF] Preloaded ${manuallyEditedTitles.size} manually edited songs in ${manualEditTime.toFixed(2)}ms`,
      )
    }

    // Phase 1: Insert/Update all songs and collect IDs
    const phase1Start = performance.now()
    for (let i = 0; i < songsInput.length; i++) {
      const input = songsInput[i]

      try {
        const categoryId = input.categoryId ?? defaultCategoryId ?? null
        // Sanitize the title to remove special characters like /: from the beginning
        const title = sanitizeSongTitle(input.title || '')

        // Check if song was manually edited and should be skipped (O(1) lookup)
        if (manuallyEditedTitles?.has(title.toLowerCase())) {
          skippedCount++
          errors.push(`Song "${input.title}": manually edited (skipped)`)
          continue
        }

        const result = upsertSongStmt.get(
          title,
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

    const phase1Time = performance.now() - phase1Start
    log(
      'info',
      `[PERF] Phase 1 (upsert songs): ${phase1Time.toFixed(2)}ms for ${songsInput.length} songs (${(phase1Time / songsInput.length).toFixed(2)}ms/song)`,
    )

    // Phase 2: Bulk delete old slides for all imported songs (when overwriting)
    const phase2Start = performance.now()
    if (overwriteDuplicates && songIds.length > 0) {
      const placeholders = songIds.map(() => '?').join(',')
      rawDb
        .query(`DELETE FROM song_slides WHERE song_id IN (${placeholders})`)
        .run(...songIds)
    }

    const phase2Time = performance.now() - phase2Start
    log('info', `[PERF] Phase 2 (delete slides): ${phase2Time.toFixed(2)}ms`)

    // Phase 3: Bulk insert all slides at once (super batch)
    const phase3Start = performance.now()
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
      insertSlidesBulkAll(rawDb, allSlides, now)
    }
    const phase3Time = performance.now() - phase3Start
    log(
      'info',
      `[PERF] Phase 3 (insert slides): ${phase3Time.toFixed(2)}ms for ${allSlides.length} slides`,
    )

    rawDb.exec('COMMIT')
    const totalTime = performance.now() - totalStart
    log(
      'info',
      `[PERF] Batch import total: ${totalTime.toFixed(2)}ms | Phase1: ${phase1Time.toFixed(0)}ms | Phase2: ${phase2Time.toFixed(0)}ms | Phase3: ${phase3Time.toFixed(0)}ms`,
    )
    log(
      'info',
      `Batch import completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`,
    )
  } catch (error) {
    rawDb.exec('ROLLBACK')
    const msg = error instanceof Error ? error.message : String(error)
    log('error', `Batch import transaction failed: ${msg}`)
    errors.push(`Transaction failed: ${msg}`)
  }

  return { successCount, failedCount, skippedCount, songIds, errors }
}
