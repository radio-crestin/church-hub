import { asc, eq, inArray, sql } from 'drizzle-orm'

import type {
  OperationResult,
  ReorderTagsInput,
  SongTag,
  UpsertTagInput,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { songTagAssignments, songTags } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('song-tags')

function toTag(record: typeof songTags.$inferSelect, songCount = 0): SongTag {
  return {
    id: record.id,
    name: record.name,
    sortOrder: record.sortOrder,
    songCount,
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

export function getAllTags(): SongTag[] {
  try {
    const db = getDatabase()
    const records = db
      .select({
        tag: songTags,
        songCount: sql<number>`COUNT(${songTagAssignments.songId})`.as(
          'song_count',
        ),
      })
      .from(songTags)
      .leftJoin(songTagAssignments, eq(songTagAssignments.tagId, songTags.id))
      .groupBy(songTags.id)
      .orderBy(asc(songTags.sortOrder), asc(songTags.name))
      .all()

    return records.map((r) => toTag(r.tag, r.songCount))
  } catch (error) {
    logger.error(`Failed to get all tags: ${error}`)
    return []
  }
}

export function getTagsBySongId(songId: number): SongTag[] {
  try {
    const db = getDatabase()
    const records = db
      .select({ tag: songTags })
      .from(songTagAssignments)
      .innerJoin(songTags, eq(songTags.id, songTagAssignments.tagId))
      .where(eq(songTagAssignments.songId, songId))
      .orderBy(asc(songTags.sortOrder), asc(songTags.name))
      .all()

    return records.map((r) => toTag(r.tag, 0))
  } catch (error) {
    logger.error(`Failed to get tags for song ${songId}: ${error}`)
    return []
  }
}

/**
 * Returns a map of songId → SongTag[] for the given song ids. Used to
 * hydrate paginated/list responses without N+1 queries.
 */
export function getTagsBySongIds(songIds: number[]): Map<number, SongTag[]> {
  const result = new Map<number, SongTag[]>()
  if (songIds.length === 0) return result

  try {
    const db = getDatabase()
    const rows = db
      .select({
        songId: songTagAssignments.songId,
        tag: songTags,
      })
      .from(songTagAssignments)
      .innerJoin(songTags, eq(songTags.id, songTagAssignments.tagId))
      .where(inArray(songTagAssignments.songId, songIds))
      .orderBy(asc(songTags.sortOrder), asc(songTags.name))
      .all()

    for (const row of rows) {
      const list = result.get(row.songId) ?? []
      list.push(toTag(row.tag, 0))
      result.set(row.songId, list)
    }
    return result
  } catch (error) {
    logger.error(`Failed to get tags for songs: ${error}`)
    return result
  }
}

export function upsertTag(input: UpsertTagInput): SongTag | null {
  try {
    const db = getDatabase()
    const rawDb = getRawDatabase()

    if (input.id) {
      const setClauses: string[] = ['updated_at = unixepoch()']
      if (input.name !== undefined) {
        setClauses.push(`name = '${input.name.replace(/'/g, "''")}'`)
      }
      if (input.sortOrder !== undefined) {
        setClauses.push(`sort_order = ${input.sortOrder}`)
      }

      const result = rawDb
        .prepare(
          `
        UPDATE song_tags
        SET ${setClauses.join(', ')}
        WHERE id = ?
        RETURNING
          id,
          name,
          sort_order as sortOrder,
          created_at as createdAt,
          updated_at as updatedAt,
          (SELECT COUNT(*) FROM song_tag_assignments WHERE tag_id = ?) as songCount
      `,
        )
        .get(input.id, input.id) as
        | {
            id: number
            name: string
            sortOrder: number
            createdAt: number
            updatedAt: number
            songCount: number
          }
        | undefined

      if (!result) {
        logger.warning(`Tag not found for update: ${input.id}`)
        return null
      }

      logger.info(`Tag updated: ${input.id}`)
      return {
        id: result.id,
        name: result.name,
        sortOrder: result.sortOrder,
        songCount: result.songCount,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      }
    }

    // New tag: append at the end (max(sort_order) + 1)
    const maxRow = rawDb
      .query('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM song_tags')
      .get() as { maxOrder: number }
    const nextOrder = input.sortOrder ?? maxRow.maxOrder + 1

    const inserted = db
      .insert(songTags)
      .values({
        name: input.name,
        sortOrder: nextOrder,
      })
      .returning()
      .get()

    logger.info(`Tag created: ${inserted.id}`)
    return toTag(inserted, 0)
  } catch (error) {
    logger.error(`Failed to upsert tag: ${error}`)
    return null
  }
}

/**
 * Deletes a tag. Songs that have it stay; only the assignments are removed
 * (cascaded via FK). Unlike categories, deleting a tag never deletes songs
 * because a song may have multiple tags.
 */
export function deleteTag(id: number): OperationResult {
  try {
    const db = getDatabase()
    db.delete(songTags).where(eq(songTags.id, id)).run()
    logger.info(`Tag deleted: ${id}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete tag: ${error}`)
    return { success: false, error: String(error) }
  }
}

export function reorderTags(input: ReorderTagsInput): OperationResult {
  try {
    const rawDb = getRawDatabase()
    rawDb.exec('BEGIN TRANSACTION')
    try {
      const db = getDatabase()
      for (let i = 0; i < input.tagIds.length; i++) {
        db.update(songTags)
          .set({
            sortOrder: i,
            updatedAt: sql`(unixepoch())` as unknown as Date,
          })
          .where(eq(songTags.id, input.tagIds[i]))
          .run()
      }
      rawDb.exec('COMMIT')
      return { success: true }
    } catch (error) {
      rawDb.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    logger.error(`Failed to reorder tags: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Replaces all tag assignments for a song. Pass an empty array to clear.
 * Runs inside a transaction with a delete + bulk insert.
 */
export function setSongTags(songId: number, tagIds: number[]): void {
  const rawDb = getRawDatabase()
  rawDb.exec('BEGIN TRANSACTION')
  try {
    const db = getDatabase()
    db.delete(songTagAssignments)
      .where(eq(songTagAssignments.songId, songId))
      .run()

    const unique = Array.from(new Set(tagIds))
    if (unique.length > 0) {
      db.insert(songTagAssignments)
        .values(unique.map((tagId) => ({ songId, tagId })))
        .run()
    }
    rawDb.exec('COMMIT')
  } catch (error) {
    rawDb.exec('ROLLBACK')
    logger.error(`Failed to set tags for song ${songId}: ${error}`)
    throw error
  }
}
