import { and, asc, eq, gt, inArray, max, sql } from 'drizzle-orm'

import type {
  OperationResult,
  ReorderSongSlidesInput,
  SongSlide,
  UpsertSongSlideInput,
} from './types'
import { getDatabase } from '../../db'
import { songSlides } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('song-slides')

/**
 * Converts database slide record to API format
 */
function toSongSlide(record: typeof songSlides.$inferSelect): SongSlide {
  let chords = null
  if (record.chords) {
    try {
      chords = JSON.parse(record.chords)
    } catch {
      chords = null
    }
  }
  return {
    id: record.id,
    songId: record.songId,
    content: record.content,
    chords,
    sortOrder: record.sortOrder,
    label: record.label,
    createdAt:
      record.createdAt instanceof Date
        ? Math.floor(record.createdAt.getTime() / 1000)
        : (record.createdAt as unknown as number),
    updatedAt:
      record.updatedAt instanceof Date
        ? Math.floor(record.updatedAt.getTime() / 1000)
        : (record.updatedAt as unknown as number),
  }
}

/**
 * Gets all slides for a song
 */
export function getSlidesBySongId(songId: number): SongSlide[] {
  logger.debug(`Getting slides for song: ${songId}`)

  const db = getDatabase()
  const records = db
    .select()
    .from(songSlides)
    .where(eq(songSlides.songId, songId))
    .orderBy(asc(songSlides.sortOrder))
    .all()

  logger.debug(`Found ${records.length} slides for song ${songId}`)
  return records.map(toSongSlide)
}

/**
 * Gets slides for multiple songs in a single query (batch operation)
 * Returns a Map of songId -> slides array
 */
export function getSlidesBySongIds(
  songIds: number[],
): Map<number, SongSlide[]> {
  if (songIds.length === 0) {
    return new Map()
  }

  logger.debug(`Getting slides for ${songIds.length} songs in batch`)

  const db = getDatabase()
  const records = db
    .select()
    .from(songSlides)
    .where(inArray(songSlides.songId, songIds))
    .orderBy(asc(songSlides.songId), asc(songSlides.sortOrder))
    .all()

  // Group slides by songId
  const slidesBySongId = new Map<number, SongSlide[]>()

  // Initialize empty arrays for all requested songIds
  for (const songId of songIds) {
    slidesBySongId.set(songId, [])
  }

  // Populate with actual slides
  for (const record of records) {
    const slides = slidesBySongId.get(record.songId)
    if (slides) {
      slides.push(toSongSlide(record))
    }
  }

  logger.debug(
    `Found ${records.length} total slides for ${songIds.length} songs`,
  )
  return slidesBySongId
}

/**
 * Gets a slide by ID
 */
export function getSongSlideById(id: number): SongSlide | null {
  try {
    logger.debug(`Getting song slide by ID: ${id}`)

    const db = getDatabase()
    const record = db
      .select()
      .from(songSlides)
      .where(eq(songSlides.id, id))
      .get()

    if (!record) {
      logger.debug(`Song slide not found: ${id}`)
      return null
    }

    return toSongSlide(record)
  } catch (error) {
    logger.error(`Failed to get song slide: ${error}`)
    return null
  }
}

/**
 * Gets the next sort order for a song
 */
function getNextSortOrder(songId: number): number {
  const db = getDatabase()
  const result = db
    .select({ maxOrder: max(songSlides.sortOrder) })
    .from(songSlides)
    .where(eq(songSlides.songId, songId))
    .get()
  return (result?.maxOrder ?? -1) + 1
}

/**
 * Creates or updates a song slide
 */
export function upsertSongSlide(input: UpsertSongSlideInput): SongSlide | null {
  try {
    const db = getDatabase()

    if (input.id) {
      logger.debug(`Updating song slide: ${input.id}`)

      db.update(songSlides)
        .set({
          content: input.content,
          label: input.label ?? null,
          chords: input.chords ? JSON.stringify(input.chords) : null,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(eq(songSlides.id, input.id))
        .run()

      logger.info(`Song slide updated: ${input.id}`)
      return getSongSlideById(input.id)
    }

    logger.debug(`Creating song slide for song: ${input.songId}`)

    const sortOrder = input.sortOrder ?? getNextSortOrder(input.songId)

    const inserted = db
      .insert(songSlides)
      .values({
        songId: input.songId,
        content: input.content,
        chords: input.chords ? JSON.stringify(input.chords) : null,
        sortOrder,
        label: input.label ?? null,
      })
      .returning({ id: songSlides.id })
      .get()

    logger.info(`Song slide created: ${inserted.id}`)
    return getSongSlideById(inserted.id)
  } catch (error) {
    logger.error(`Failed to upsert song slide: ${error}`)
    return null
  }
}

/**
 * Deletes a song slide
 */
export function deleteSongSlide(id: number): OperationResult {
  try {
    logger.debug(`Deleting song slide: ${id}`)

    const db = getDatabase()
    db.delete(songSlides).where(eq(songSlides.id, id)).run()

    logger.info(`Song slide deleted: ${id}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete song slide: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Clones a song slide
 */
export function cloneSongSlide(id: number): SongSlide | null {
  try {
    logger.debug(`Cloning song slide: ${id}`)

    const original = getSongSlideById(id)
    if (!original) {
      logger.error(`Original slide not found: ${id}`)
      return null
    }

    const db = getDatabase()
    const sortOrder = original.sortOrder + 1

    // Shift all slides after the original one
    db.update(songSlides)
      .set({
        sortOrder: sql`${songSlides.sortOrder} + 1`,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(
        and(
          eq(songSlides.songId, original.songId),
          gt(songSlides.sortOrder, original.sortOrder),
        ),
      )
      .run()

    // Insert the cloned slide
    const inserted = db
      .insert(songSlides)
      .values({
        songId: original.songId,
        content: original.content,
        sortOrder,
        label: original.label,
      })
      .returning({ id: songSlides.id })
      .get()

    logger.info(`Song slide cloned: ${id} -> ${inserted.id}`)
    return getSongSlideById(inserted.id)
  } catch (error) {
    logger.error(`Failed to clone song slide: ${error}`)
    return null
  }
}

/**
 * Reorders slides within a song using a single batch UPDATE with CASE
 */
export function reorderSongSlides(
  songId: number,
  input: ReorderSongSlidesInput,
): OperationResult {
  try {
    logger.debug(`Reordering slides for song: ${songId}`)

    if (input.slideIds.length === 0) {
      return { success: true }
    }

    const db = getDatabase()

    // Build a single UPDATE with CASE for all slides (batch operation)
    // This reduces N queries to 1 query
    const caseParts = input.slideIds
      .map((id, index) => `WHEN ${id} THEN ${index}`)
      .join(' ')
    const idList = input.slideIds.join(',')

    db.run(
      sql.raw(`
      UPDATE song_slides
      SET sort_order = CASE id ${caseParts} END,
          updated_at = unixepoch()
      WHERE id IN (${idList}) AND song_id = ${songId}
    `),
    )

    logger.info(`Slides reordered for song: ${songId} (batch)`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to reorder slides: ${error}`)
    return { success: false, error: String(error) }
  }
}
