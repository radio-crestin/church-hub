import { desc, eq, isNull, sql } from 'drizzle-orm'

import type {
  OperationResult,
  ReorderCategoriesInput,
  SongCategory,
  UpsertCategoryInput,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { songCategories, songs } from '../../db/schema'

import { createLogger } from '../../utils/logger'

const logger = createLogger('song-categories')

/**
 * Converts database category record to API format
 */
function toCategory(
  record: typeof songCategories.$inferSelect,
  songCount = 0,
): SongCategory {
  return {
    id: record.id,
    name: record.name,
    priority: record.priority,
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

/**
 * Gets all song categories ordered by priority (highest first)
 */
export function getAllCategories(): SongCategory[] {
  try {
    logger.debug('Getting all categories')

    const db = getDatabase()
    const records = db
      .select({
        category: songCategories,
        songCount: sql<number>`COUNT(${songs.id})`.as('song_count'),
      })
      .from(songCategories)
      .leftJoin(songs, eq(songs.categoryId, songCategories.id))
      .groupBy(songCategories.id)
      .orderBy(desc(songCategories.priority), songCategories.name)
      .all()

    return records.map((r) => toCategory(r.category, r.songCount))
  } catch (error) {
    logger.error(`Failed to get all categories: ${error}`)
    return []
  }
}

/**
 * Gets a category by ID
 */
export function getCategoryById(id: number): SongCategory | null {
  try {
    logger.debug(`Getting category by ID: ${id}`)

    const db = getDatabase()
    const record = db
      .select({
        category: songCategories,
        songCount: sql<number>`COUNT(${songs.id})`.as('song_count'),
      })
      .from(songCategories)
      .leftJoin(songs, eq(songs.categoryId, songCategories.id))
      .where(eq(songCategories.id, id))
      .groupBy(songCategories.id)
      .get()

    if (!record) {
      logger.debug(`Category not found: ${id}`)
      return null
    }

    return toCategory(record.category, record.songCount)
  } catch (error) {
    logger.error(`Failed to get category: ${error}`)
    return null
  }
}

/**
 * Creates or updates a category
 * Uses efficient single-query approach with RETURNING and subquery for song count
 */
export function upsertCategory(
  input: UpsertCategoryInput,
): SongCategory | null {
  try {
    const db = getDatabase()
    const rawDb = getRawDatabase()

    if (input.id) {
      logger.debug(`Updating category: ${input.id}`)

      // Build SET clause dynamically
      const setClauses: string[] = ['updated_at = unixepoch()']
      if (input.name !== undefined) {
        setClauses.push(`name = '${input.name.replace(/'/g, "''")}'`)
      }
      if (input.priority !== undefined) {
        setClauses.push(`priority = ${input.priority}`)
      }

      // Single efficient query: UPDATE with RETURNING + subquery for song count
      const result = rawDb
        .prepare(
          `
        UPDATE song_categories
        SET ${setClauses.join(', ')}
        WHERE id = ?
        RETURNING
          id,
          name,
          priority,
          created_at as createdAt,
          updated_at as updatedAt,
          (SELECT COUNT(*) FROM songs WHERE category_id = ?) as songCount
      `,
        )
        .get(input.id, input.id) as
        | {
            id: number
            name: string
            priority: number
            createdAt: number
            updatedAt: number
            songCount: number
          }
        | undefined

      if (!result) {
        logger.warning(`Category not found for update: ${input.id}`)
        return null
      }

      logger.info(`Category updated: ${input.id}`)
      return {
        id: result.id,
        name: result.name,
        priority: result.priority,
        songCount: result.songCount,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      }
    }

    // For new categories, default priority is 1
    const nextPriority = input.priority ?? 1

    logger.debug(
      `Creating category: ${input.name} with priority: ${nextPriority}`,
    )

    // Single efficient query: INSERT with RETURNING (new category has 0 songs)
    const inserted = db
      .insert(songCategories)
      .values({
        name: input.name,
        priority: nextPriority,
      })
      .returning()
      .get()

    logger.info(`Category created: ${inserted.id}`)
    return toCategory(inserted, 0)
  } catch (error) {
    logger.error(`Failed to upsert category: ${error}`)
    return null
  }
}

/**
 * Deletes a category and all songs belonging to it
 * Songs' slides are automatically deleted via CASCADE
 */
export function deleteCategory(id: number): OperationResult {
  try {
    logger.debug(`Deleting category: ${id}`)

    const db = getDatabase()

    // Delete all songs belonging to this category first
    // (song_slides are deleted automatically via CASCADE on songs table)
    const deletedSongs = db
      .delete(songs)
      .where(eq(songs.categoryId, id))
      .returning({ id: songs.id })
      .all()

    logger.debug(
      `Deleted ${deletedSongs.length} songs belonging to category ${id}`,
    )

    // Delete the category
    db.delete(songCategories).where(eq(songCategories.id, id)).run()

    logger.info(`Category deleted: ${id}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete category: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Deletes all songs without a category (categoryId is null)
 * Songs' slides are automatically deleted via CASCADE
 */
export function deleteUncategorizedSongs(): OperationResult & {
  deletedCount: number
  deletedIds: number[]
} {
  try {
    logger.debug('Deleting uncategorized songs')

    const db = getDatabase()

    // Delete all songs without a category
    const deletedSongs = db
      .delete(songs)
      .where(isNull(songs.categoryId))
      .returning({ id: songs.id })
      .all()

    const deletedIds = deletedSongs.map((s) => s.id)

    logger.info(`Deleted ${deletedSongs.length} uncategorized songs`)
    return { success: true, deletedCount: deletedSongs.length, deletedIds }
  } catch (error) {
    logger.error(`Failed to delete uncategorized songs: ${error}`)
    return {
      success: false,
      error: String(error),
      deletedCount: 0,
      deletedIds: [],
    }
  }
}

/**
 * Reorders categories by updating their priorities based on array order
 * First item in array gets highest priority
 */
export function reorderCategories(
  input: ReorderCategoriesInput,
): OperationResult {
  try {
    logger.debug(`Reordering ${input.categoryIds.length} categories`)

    const rawDb = getRawDatabase()

    rawDb.exec('BEGIN TRANSACTION')

    try {
      const db = getDatabase()

      // Assign priorities in descending order (first = highest)
      for (let i = 0; i < input.categoryIds.length; i++) {
        const id = input.categoryIds[i]
        const priority = input.categoryIds.length - i

        db.update(songCategories)
          .set({
            priority,
            updatedAt: sql`(unixepoch())` as unknown as Date,
          })
          .where(eq(songCategories.id, id))
          .run()
      }

      rawDb.exec('COMMIT')
      logger.info('Categories reordered successfully')
      return { success: true }
    } catch (error) {
      rawDb.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    logger.error(`Failed to reorder categories: ${error}`)
    return { success: false, error: String(error) }
  }
}
