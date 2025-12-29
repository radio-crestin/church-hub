import { desc, eq, isNull, max, sql } from 'drizzle-orm'

import type {
  OperationResult,
  ReorderCategoriesInput,
  SongCategory,
  UpsertCategoryInput,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { songCategories, songs } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-categories] ${message}`)
}

/**
 * Converts database category record to API format
 */
function toCategory(record: typeof songCategories.$inferSelect): SongCategory {
  return {
    id: record.id,
    name: record.name,
    priority: record.priority,
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
    log('debug', 'Getting all categories')

    const db = getDatabase()
    const records = db
      .select()
      .from(songCategories)
      .orderBy(desc(songCategories.priority), songCategories.name)
      .all()

    return records.map(toCategory)
  } catch (error) {
    log('error', `Failed to get all categories: ${error}`)
    return []
  }
}

/**
 * Gets a category by ID
 */
export function getCategoryById(id: number): SongCategory | null {
  try {
    log('debug', `Getting category by ID: ${id}`)

    const db = getDatabase()
    const record = db
      .select()
      .from(songCategories)
      .where(eq(songCategories.id, id))
      .get()

    if (!record) {
      log('debug', `Category not found: ${id}`)
      return null
    }

    return toCategory(record)
  } catch (error) {
    log('error', `Failed to get category: ${error}`)
    return null
  }
}

/**
 * Creates or updates a category
 */
export function upsertCategory(
  input: UpsertCategoryInput,
): SongCategory | null {
  try {
    const db = getDatabase()

    if (input.id) {
      log('debug', `Updating category: ${input.id}`)

      // Build update object with only provided fields
      const updateData: Partial<typeof songCategories.$inferInsert> = {
        updatedAt: sql`(unixepoch())` as unknown as Date,
      }

      if (input.name !== undefined) {
        updateData.name = input.name
      }
      if (input.priority !== undefined) {
        updateData.priority = input.priority
      }

      db.update(songCategories)
        .set(updateData)
        .where(eq(songCategories.id, input.id))
        .run()

      log('info', `Category updated: ${input.id}`)
      return getCategoryById(input.id)
    }

    // For new categories, calculate next priority (max + 1)
    const result = db
      .select({ maxPriority: max(songCategories.priority) })
      .from(songCategories)
      .get()

    const nextPriority = input.priority ?? (result?.maxPriority ?? 0) + 1

    log(
      'debug',
      `Creating category: ${input.name} with priority: ${nextPriority}`,
    )

    const inserted = db
      .insert(songCategories)
      .values({
        name: input.name,
        priority: nextPriority,
      })
      .returning({ id: songCategories.id })
      .get()

    log('info', `Category created: ${inserted.id}`)
    return getCategoryById(inserted.id)
  } catch (error) {
    log('error', `Failed to upsert category: ${error}`)
    return null
  }
}

/**
 * Deletes a category and all songs belonging to it
 * Songs' slides are automatically deleted via CASCADE
 */
export function deleteCategory(id: number): OperationResult {
  try {
    log('debug', `Deleting category: ${id}`)

    const db = getDatabase()

    // Delete all songs belonging to this category first
    // (song_slides are deleted automatically via CASCADE on songs table)
    const deletedSongs = db
      .delete(songs)
      .where(eq(songs.categoryId, id))
      .returning({ id: songs.id })
      .all()

    log(
      'debug',
      `Deleted ${deletedSongs.length} songs belonging to category ${id}`,
    )

    // Delete the category
    db.delete(songCategories).where(eq(songCategories.id, id)).run()

    log('info', `Category deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete category: ${error}`)
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
    log('debug', 'Deleting uncategorized songs')

    const db = getDatabase()

    // Delete all songs without a category
    const deletedSongs = db
      .delete(songs)
      .where(isNull(songs.categoryId))
      .returning({ id: songs.id })
      .all()

    const deletedIds = deletedSongs.map((s) => s.id)

    log('info', `Deleted ${deletedSongs.length} uncategorized songs`)
    return { success: true, deletedCount: deletedSongs.length, deletedIds }
  } catch (error) {
    log('error', `Failed to delete uncategorized songs: ${error}`)
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
    log('debug', `Reordering ${input.categoryIds.length} categories`)

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
      log('info', 'Categories reordered successfully')
      return { success: true }
    } catch (error) {
      rawDb.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to reorder categories: ${error}`)
    return { success: false, error: String(error) }
  }
}
