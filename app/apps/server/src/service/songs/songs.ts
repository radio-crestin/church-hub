import { asc, eq, inArray } from 'drizzle-orm'

import { getCategoryById } from './categories'
import {
  cleanupGroupsAfterSongDelete,
  getGroupIdsForSongs,
} from './song-groups'
import { getSlidesBySongId } from './song-slides'
import { getTagsBySongId, getTagsBySongIds, setSongTags } from './tags'
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
import { createLogger } from '../../utils/logger'
import {
  addAminToLastSlide,
  generateExpandedPresentationOrder,
} from '../presentation/expand-song-slides'

const logger = createLogger('songs')
const SLIDE_BULK_INSERT_CHUNK_SIZE = 1000 // Increased from 500 for better performance

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
    songGroupId: record.songGroupId,
    sourceFilename: record.sourceFilename,
    author: record.author,
    copyright: record.copyright,
    ccli: record.ccli,
    tempo: record.tempo,
    timeSignature: record.timeSignature,
    theme: record.theme,
    altTheme: record.altTheme,
    hymnNumber: record.hymnNumber,
    keyLine: record.keyLine,
    presentationOrder: record.presentationOrder,
    presentationCount: record.presentationCount,
    lastPresentedAt: record.lastPresentedAt
      ? Math.floor(record.lastPresentedAt.getTime() / 1000)
      : null,
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
    logger.debug('Getting all songs')

    const db = getDatabase()
    const records = db.select().from(songs).orderBy(asc(songs.title)).all()

    return records.map(toSong)
  } catch (error) {
    logger.error(`Failed to get all songs: ${error}`)
    return []
  }
}

export interface PaginatedSongsResult {
  songs: Song[]
  total: number
  hasMore: boolean
}

export type SongSortBy =
  | 'lastPlayed'
  | 'mostPlayed'
  | 'title'
  | 'newest'
  | 'oldest'

export interface SongFilters {
  categoryIds?: number[]
  /**
   * Tag ids — songs that have ANY of the listed tags match.
   * (Mirrors the OR semantics of `categoryIds` for consistency.)
   */
  tagIds?: number[]
  presentedOnly?: boolean
  inSchedulesOnly?: boolean
  hasKeyLine?: boolean
  sortBy?: SongSortBy
}

/**
 * Gets songs with pagination support
 * @param limit - Number of songs to return
 * @param offset - Number of songs to skip
 * @param filters - Optional filters (categoryIds, presentedOnly, inSchedulesOnly)
 */
export function getSongsPaginated(
  limit: number,
  offset: number,
  filters?: SongFilters,
): PaginatedSongsResult {
  try {
    const {
      categoryIds,
      tagIds,
      presentedOnly,
      inSchedulesOnly,
      hasKeyLine,
      sortBy,
    } = filters ?? {}
    logger.debug(
      `Getting songs paginated: limit=${limit}, offset=${offset}, categoryIds=${categoryIds?.join(',')}, tagIds=${tagIds?.join(',')}, presentedOnly=${presentedOnly}, inSchedulesOnly=${inSchedulesOnly}, hasKeyLine=${hasKeyLine}`,
    )

    const rawDb = getRawDatabase()

    // Build WHERE conditions
    const conditions: string[] = []
    const params: (number | string)[] = []

    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(',')
      conditions.push(`category_id IN (${placeholders})`)
      params.push(...categoryIds)
    }

    if (tagIds && tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(',')
      conditions.push(
        `id IN (SELECT song_id FROM song_tag_assignments WHERE tag_id IN (${placeholders}))`,
      )
      params.push(...tagIds)
    }

    if (presentedOnly) {
      conditions.push('presentation_count > 0')
    }

    if (inSchedulesOnly) {
      conditions.push(
        `id IN (SELECT DISTINCT song_id FROM schedule_items WHERE song_id IS NOT NULL)`,
      )
    }

    if (hasKeyLine) {
      conditions.push(`key_line IS NOT NULL AND key_line != ''`)
    }

    // Always exclude songs whose category is hidden (uncategorized songs stay
    // visible). Hiding a category removes its songs from the browser without
    // deleting them.
    conditions.push(
      `(category_id IS NULL OR category_id NOT IN (SELECT id FROM song_categories WHERE is_hidden = 1))`,
    )

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = rawDb
      .query(`SELECT COUNT(*) as total FROM songs ${whereClause}`)
      .get(...params) as { total: number }
    const total = countResult.total

    // Build ORDER BY clause based on sortBy parameter
    let orderByClause: string
    switch (sortBy) {
      case 'title':
        orderByClause = 'ORDER BY title ASC'
        break
      case 'mostPlayed':
        orderByClause =
          'ORDER BY presentation_count DESC, last_presented_at DESC NULLS LAST, title ASC'
        break
      case 'newest':
        orderByClause = 'ORDER BY created_at DESC, title ASC'
        break
      case 'oldest':
        orderByClause = 'ORDER BY created_at ASC, title ASC'
        break
      case 'lastPlayed':
      default:
        orderByClause = 'ORDER BY last_presented_at DESC NULLS LAST, title ASC'
        break
    }

    const records = rawDb
      .query(
        `SELECT * FROM songs ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<{
      id: number
      title: string
      category_id: number | null
      song_group_id: number | null
      source_filename: string | null
      author: string | null
      copyright: string | null
      ccli: string | null
      tempo: string | null
      time_signature: string | null
      theme: string | null
      alt_theme: string | null
      hymn_number: string | null
      key_line: string | null
      presentation_order: string | null
      presentation_count: number
      last_presented_at: number | null
      last_manual_edit: number | null
      created_at: number
      updated_at: number
    }>

    // Bulk-fetch tags for the page (one round-trip, no N+1) so the song list
    // can render the tag chips without a follow-up request per row.
    const tagsBySongId = getTagsBySongIds(records.map((r) => r.id))

    const songsList: Song[] = records.map((record) => ({
      id: record.id,
      title: record.title,
      categoryId: record.category_id,
      songGroupId: record.song_group_id,
      sourceFilename: record.source_filename,
      author: record.author,
      copyright: record.copyright,
      ccli: record.ccli,
      tempo: record.tempo,
      timeSignature: record.time_signature,
      theme: record.theme,
      altTheme: record.alt_theme,
      hymnNumber: record.hymn_number,
      keyLine: record.key_line,
      presentationOrder: record.presentation_order,
      presentationCount: record.presentation_count,
      lastPresentedAt: record.last_presented_at,
      lastManualEdit: record.last_manual_edit,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      tagNames: (tagsBySongId.get(record.id) ?? []).map((tag) => tag.name),
    }))

    return {
      songs: songsList,
      total,
      hasMore: offset + songsList.length < total,
    }
  } catch (error) {
    logger.error(`Failed to get paginated songs: ${error}`)
    return { songs: [], total: 0, hasMore: false }
  }
}

/**
 * Gets a song by ID
 */
export function getSongById(id: number): Song | null {
  try {
    logger.debug(`Getting song by ID: ${id}`)

    const db = getDatabase()
    const record = db.select().from(songs).where(eq(songs.id, id)).get()

    if (!record) {
      logger.debug(`Song not found: ${id}`)
      return null
    }

    return toSong(record)
  } catch (error) {
    logger.error(`Failed to get song: ${error}`)
    return null
  }
}

/**
 * Gets a song by ID with all its slides and category
 * Applies presentation transformations:
 * - Adds "Amin!" to the last slide
 * - Generates expanded presentation order with chorus insertions
 */
export function getSongWithSlides(id: number): SongWithSlides | null {
  try {
    logger.debug(`Getting song with slides: ${id}`)

    const song = getSongById(id)
    if (!song) {
      return null
    }

    const slides = getSlidesBySongId(id)
    const category = song.categoryId ? getCategoryById(song.categoryId) : null
    const tags = getTagsBySongId(id)

    // Transform slides: add "Amin!" to the last slide
    const transformedSlides = slides.map((slide, index) => ({
      ...slide,
      content: addAminToLastSlide(slide.content, index === slides.length - 1),
    }))

    // Generate expanded presentation order (C1 V1 C1 V2 C1 V3 C2...)
    const expandedPresentationOrder = generateExpandedPresentationOrder(slides)

    return {
      ...song,
      presentationOrder: expandedPresentationOrder || song.presentationOrder,
      slides: transformedSlides,
      category,
      tags,
    }
  } catch (error) {
    logger.error(`Failed to get song with slides: ${error}`)
    return null
  }
}

/**
 * Gets all songs with their slides and categories
 * Optionally filters by category ID
 * Applies presentation transformations:
 * - Adds "Amin!" to the last slide
 * - Generates expanded presentation order with chorus insertions
 */
export function getAllSongsWithSlides(
  categoryId?: number | null,
): SongWithSlides[] {
  try {
    logger.debug(`Getting all songs with slides, categoryId: ${categoryId}`)

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

    const tagsBySongId = getTagsBySongIds(records.map((r) => r.id))

    return records.map((record) => {
      const song = toSong(record)
      const slides = getSlidesBySongId(song.id)
      const category = song.categoryId ? getCategoryById(song.categoryId) : null

      // Transform slides: add "Amin!" to the last slide
      const transformedSlides = slides.map((slide, index) => ({
        ...slide,
        content: addAminToLastSlide(slide.content, index === slides.length - 1),
      }))

      // Generate expanded presentation order (C1 V1 C1 V2 C1 V3 C2...)
      const expandedPresentationOrder =
        generateExpandedPresentationOrder(slides)

      return {
        ...song,
        presentationOrder: expandedPresentationOrder || song.presentationOrder,
        slides: transformedSlides,
        category,
        tags: tagsBySongId.get(song.id) ?? [],
      }
    })
  } catch (error) {
    logger.error(`Failed to get all songs with slides: ${error}`)
    return []
  }
}

/**
 * Creates or updates a song with optional slides.
 * Throws on failure so callers can surface the real error message.
 */
export function upsertSong(input: UpsertSongInput): SongWithSlides | null {
  const db = getDatabase()
  const now = new Date()
  // Preserve the user's title verbatim (trim only). Sanitization stripped
  // legitimate content like leading hymn numbers and punctuation.
  const title = input.title.trim() || 'Untitled Song'

  let songId: number

  try {
    if (input.id) {
      logger.debug(`Updating song: ${input.id}`)

      // Build update object
      const updateData: Record<string, any> = {
        title,
        categoryId: input.categoryId ?? null,
        sourceFilename: input.sourceFilename ?? null,
        author: input.author ?? null,
        copyright: input.copyright ?? null,
        ccli: input.ccli ?? null,
        tempo: input.tempo ?? null,
        timeSignature: input.timeSignature ?? null,
        theme: input.theme ?? null,
        altTheme: input.altTheme ?? null,
        hymnNumber: input.hymnNumber ?? null,
        keyLine: input.keyLine ?? null,
        presentationOrder: input.presentationOrder ?? null,
        updatedAt: now,
      }

      // Update presentationCount if explicitly provided
      if (input.presentationCount !== undefined) {
        updateData.presentationCount = input.presentationCount
      }

      // Set last_manual_edit only when isManualEdit is true (UI edit)
      if (input.isManualEdit) {
        updateData.lastManualEdit = now
      }

      db.update(songs).set(updateData).where(eq(songs.id, input.id)).run()
      songId = input.id

      logger.info(`Song updated: ${input.id}`)
    } else {
      logger.debug(`Creating song: ${title}`)

      // Set last_manual_edit only when isManualEdit is true (UI edit)
      const lastManualEdit = input.isManualEdit ? now : null

      const result = db
        .insert(songs)
        .values({
          title,
          categoryId: input.categoryId ?? null,
          sourceFilename: input.sourceFilename ?? null,
          author: input.author ?? null,
          copyright: input.copyright ?? null,
          ccli: input.ccli ?? null,
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

      logger.info(`Song created: ${songId}`)
    }

    // Handle slides if provided
    if (input.slides !== undefined) {
      logger.debug(
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
              chords: slide.chords ? JSON.stringify(slide.chords) : null,
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
              chords: slide.chords ? JSON.stringify(slide.chords) : null,
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
        logger.debug(`Deleted ${idsToDelete.length} slides`)
      }
    }

    if (input.tagIds !== undefined) {
      setSongTags(songId, input.tagIds)
    }

    return getSongWithSlides(songId)
  } catch (error) {
    logger.error(`Failed to upsert song: ${error}`)
    throw error
  }
}

/**
 * Resets the presentation count for a song to 0
 * This only updates the presentationCount field, preserving all other data
 */
export function resetSongPresentationCount(id: number): SongWithSlides | null {
  try {
    logger.debug(`Resetting presentation count for song: ${id}`)

    const db = getDatabase()

    db.update(songs)
      .set({
        presentationCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(songs.id, id))
      .run()

    logger.info(`Presentation count reset for song: ${id}`)
    return getSongWithSlides(id)
  } catch (error) {
    logger.error(`Failed to reset presentation count: ${error}`)
    return null
  }
}

/**
 * Deletes a song and all its slides (cascading)
 */
export function deleteSong(id: number): OperationResult {
  try {
    logger.debug(`Deleting song: ${id}`)

    const db = getDatabase()

    // Snapshot the group ids BEFORE the row is gone — the FK is
    // `ON DELETE SET NULL`, so after the delete we can't ask "which group
    // did this song belong to?" any more.
    const affectedGroupIds = getGroupIdsForSongs([id])

    // Slides are deleted automatically via CASCADE
    db.delete(songs).where(eq(songs.id, id)).run()

    // Collapse any group that's now down to ≤ 1 member. Without this the
    // operator's "Other versions" panel would surface a "group of me alone"
    // (count 1, no other songs to compare against).
    cleanupGroupsAfterSongDelete(affectedGroupIds)

    logger.info(`Song deleted: ${id}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete song: ${error}`)
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

    logger.debug(`Deleting ${ids.length} songs`)

    const db = getDatabase()

    // Snapshot membership BEFORE the delete; see `deleteSong` for why.
    const affectedGroupIds = getGroupIdsForSongs(ids)

    // Slides are deleted automatically via CASCADE
    const result = db.delete(songs).where(inArray(songs.id, ids)).run()

    cleanupGroupsAfterSongDelete(affectedGroupIds)

    logger.info(`Songs deleted: ${result.changes}`)
    return { success: true, deletedCount: result.changes }
  } catch (error) {
    logger.error(`Failed to delete songs: ${error}`)
    return { success: false, error: String(error), deletedCount: 0 }
  }
}

/**
 * Compares the slide content of an imported song against an existing song's slides.
 * Returns true if the content is identical (ignoring whitespace differences).
 */
export function compareSongContent(
  existingSongId: number,
  importedSlides: Array<{ content: string; sortOrder: number }>,
): boolean {
  const existingSlides = getSlidesBySongId(existingSongId)

  if (existingSlides.length !== importedSlides.length) {
    return false
  }

  // Sort both by sortOrder to ensure consistent comparison
  const sortedExisting = [...existingSlides].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const sortedImported = [...importedSlides].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  for (let i = 0; i < sortedExisting.length; i++) {
    const existingContent = sortedExisting[i].content.trim()
    const importedContent = sortedImported[i].content.trim()
    if (existingContent !== importedContent) {
      return false
    }
  }

  return true
}

/**
 * Batch imports multiple songs in a single transaction
 * Optimized for high performance with:
 * - Manual title-lookup map (no UNIQUE constraint on title)
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
  logger.info(`Starting batch import of ${songsInput.length} songs`)

  try {
    // Use transaction for atomic batch insert
    rawDb.exec('BEGIN TRANSACTION')

    // Title uniqueness is no longer enforced at the DB level. Preload existing
    // titles (lower-cased) so we can decide insert / update / skip per row.
    const existingByTitle = new Map<
      string,
      { id: number; lastManualEdit: number | null }
    >()
    const existingLookupStart = performance.now()
    const existingRows = rawDb
      .query(
        'SELECT id, LOWER(title) as lower_title, last_manual_edit FROM songs',
      )
      .all() as {
      id: number
      lower_title: string
      last_manual_edit: number | null
    }[]
    for (const row of existingRows) {
      if (!existingByTitle.has(row.lower_title)) {
        existingByTitle.set(row.lower_title, {
          id: row.id,
          lastManualEdit: row.last_manual_edit,
        })
      }
    }
    logger.info(
      `[PERF] Preloaded ${existingByTitle.size} existing song titles in ${(performance.now() - existingLookupStart).toFixed(2)}ms`,
    )

    const insertSongStmt = rawDb.query(`
      INSERT INTO songs (
        title, category_id, source_filename,
        author, copyright, ccli, tempo, time_signature,
        theme, alt_theme, hymn_number, key_line, presentation_order,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `)

    const updateSongStmt = rawDb.query(`
      UPDATE songs SET
        category_id = ?,
        source_filename = ?,
        author = ?,
        copyright = ?,
        ccli = ?,
        tempo = ?,
        time_signature = ?,
        theme = ?,
        alt_theme = ?,
        hymn_number = ?,
        key_line = ?,
        presentation_order = ?,
        updated_at = ?
      WHERE id = ?
    `)

    // Collect all song IDs and their slides for batch processing
    const songsWithIds: Array<{
      songId: number
      slides: SlideInput[]
      isUpdate: boolean
    }> = []

    // Phase 1: Insert/Update all songs and collect IDs
    const phase1Start = performance.now()
    for (let i = 0; i < songsInput.length; i++) {
      const input = songsInput[i]

      try {
        const categoryId = input.categoryId ?? defaultCategoryId ?? null
        // Preserve title verbatim — do not strip numbers or punctuation.
        const title = (input.title || '').trim() || 'Untitled Song'
        const existing = existingByTitle.get(title.toLowerCase()) ?? null

        if (existing && skipManuallyEdited && existing.lastManualEdit) {
          skippedCount++
          errors.push(`Song "${input.title}": manually edited (skipped)`)
          continue
        }

        if (existing && overwriteDuplicates) {
          updateSongStmt.run(
            categoryId,
            input.sourceFilename ?? null,
            input.author ?? null,
            input.copyright ?? null,
            input.ccli ?? null,
            input.tempo ?? null,
            input.timeSignature ?? null,
            input.theme ?? null,
            input.altTheme ?? null,
            input.hymnNumber ?? null,
            input.keyLine ?? null,
            input.presentationOrder ?? null,
            now,
            existing.id,
          )
          songIds.push(existing.id)
          songsWithIds.push({
            songId: existing.id,
            slides: input.slides || [],
            isUpdate: true,
          })
          successCount++
          continue
        }

        if (existing) {
          // Not overwriting — skip when content matches an existing copy.
          const importedSlides = (input.slides || []).map((s) => ({
            content: s.content,
            sortOrder: s.sortOrder,
          }))
          if (compareSongContent(existing.id, importedSlides)) {
            skippedCount++
            errors.push(`Song "${input.title}": identical content (skipped)`)
            continue
          }
        }

        const result = insertSongStmt.get(
          title,
          categoryId,
          input.sourceFilename ?? null,
          input.author ?? null,
          input.copyright ?? null,
          input.ccli ?? null,
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
          songsWithIds.push({
            songId: result.id,
            slides: input.slides || [],
            isUpdate: false,
          })
          // Track the new row so subsequent inputs in the same batch with the
          // same title still have an anchor for the identical-content check.
          if (!existingByTitle.has(title.toLowerCase())) {
            existingByTitle.set(title.toLowerCase(), {
              id: result.id,
              lastManualEdit: null,
            })
          }
          successCount++
        } else {
          failedCount++
          errors.push(`Song "${input.title}": insert returned no id`)
        }
      } catch (error) {
        failedCount++
        const msg = error instanceof Error ? error.message : String(error)
        errors.push(`Song "${input.title}": ${msg}`)
        logger.error(`Failed to import song ${i + 1}: ${msg}`)
      }
    }

    const phase1Time = performance.now() - phase1Start
    logger.info(
      `[PERF] Phase 1 (upsert songs): ${phase1Time.toFixed(2)}ms for ${songsInput.length} songs (${(phase1Time / songsInput.length).toFixed(2)}ms/song)`,
    )

    // Phase 2: Bulk delete old slides for updated songs only — freshly inserted
    // rows have no slides to clear.
    const phase2Start = performance.now()
    const updatedSongIds = songsWithIds
      .filter((s) => s.isUpdate)
      .map((s) => s.songId)
    if (updatedSongIds.length > 0) {
      const placeholders = updatedSongIds.map(() => '?').join(',')
      rawDb
        .query(`DELETE FROM song_slides WHERE song_id IN (${placeholders})`)
        .run(...updatedSongIds)
    }

    const phase2Time = performance.now() - phase2Start
    logger.info(`[PERF] Phase 2 (delete slides): ${phase2Time.toFixed(2)}ms`)

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
    logger.info(
      `[PERF] Phase 3 (insert slides): ${phase3Time.toFixed(2)}ms for ${allSlides.length} slides`,
    )

    rawDb.exec('COMMIT')
    const totalTime = performance.now() - totalStart
    logger.info(
      `[PERF] Batch import total: ${totalTime.toFixed(2)}ms | Phase1: ${phase1Time.toFixed(0)}ms | Phase2: ${phase2Time.toFixed(0)}ms | Phase3: ${phase3Time.toFixed(0)}ms`,
    )
    logger.info(
      `Batch import completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`,
    )
  } catch (error) {
    rawDb.exec('ROLLBACK')
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`Batch import transaction failed: ${msg}`)
    errors.push(`Transaction failed: ${msg}`)
  }

  return { successCount, failedCount, skippedCount, songIds, errors }
}
