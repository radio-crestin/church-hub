import type {
  OperationResult,
  ReorderCategoriesInput,
  SongCategory,
  SongCategoryRecord,
  UpsertCategoryInput,
} from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-categories] ${message}`)
}

/**
 * Converts database category record to API format
 */
function toCategory(record: SongCategoryRecord): SongCategory {
  return {
    id: record.id,
    name: record.name,
    priority: record.priority,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all song categories ordered by priority (highest first)
 */
export function getAllCategories(): SongCategory[] {
  try {
    log('debug', 'Getting all categories')

    const db = getDatabase()
    const query = db.query(
      'SELECT * FROM song_categories ORDER BY priority DESC, name ASC',
    )
    const records = query.all() as SongCategoryRecord[]

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
    const query = db.query('SELECT * FROM song_categories WHERE id = ?')
    const record = query.get(id) as SongCategoryRecord | null

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
    const now = Math.floor(Date.now() / 1000)

    if (input.id) {
      log('debug', `Updating category: ${input.id}`)

      // Build dynamic update query based on provided fields
      const updates: string[] = ['updated_at = ?']
      const values: (string | number)[] = [now]

      if (input.name !== undefined) {
        updates.push('name = ?')
        values.push(input.name)
      }
      if (input.priority !== undefined) {
        updates.push('priority = ?')
        values.push(input.priority)
      }

      values.push(input.id)
      const query = db.query(`
        UPDATE song_categories
        SET ${updates.join(', ')}
        WHERE id = ?
      `)
      query.run(...values)

      log('info', `Category updated: ${input.id}`)
      return getCategoryById(input.id)
    }

    // For new categories, calculate next priority (max + 1)
    const maxPriorityQuery = db.query(
      'SELECT MAX(priority) as max_priority FROM song_categories',
    )
    const result = maxPriorityQuery.get() as { max_priority: number | null }
    const nextPriority = input.priority ?? (result?.max_priority ?? 0) + 1

    log(
      'debug',
      `Creating category: ${input.name} with priority: ${nextPriority}`,
    )

    const insertQuery = db.query(`
      INSERT INTO song_categories (name, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    insertQuery.run(input.name, nextPriority, now, now)

    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id } = getLastId.get() as { id: number }

    log('info', `Category created: ${id}`)
    return getCategoryById(id)
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
    const deleteSongsQuery = db.query('DELETE FROM songs WHERE category_id = ?')
    const songsResult = deleteSongsQuery.run(id)
    log(
      'debug',
      `Deleted ${songsResult.changes} songs belonging to category ${id}`,
    )

    // Delete the category
    const deleteCategoryQuery = db.query(
      'DELETE FROM song_categories WHERE id = ?',
    )
    deleteCategoryQuery.run(id)

    log('info', `Category deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete category: ${error}`)
    return { success: false, error: String(error) }
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

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    db.exec('BEGIN TRANSACTION')

    try {
      // Assign priorities in descending order (first = highest)
      for (let i = 0; i < input.categoryIds.length; i++) {
        const id = input.categoryIds[i]
        const priority = input.categoryIds.length - i
        db.query(`
          UPDATE song_categories
          SET priority = ?, updated_at = ?
          WHERE id = ?
        `).run(priority, now, id)
      }

      db.exec('COMMIT')
      log('info', 'Categories reordered successfully')
      return { success: true }
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to reorder categories: ${error}`)
    return { success: false, error: String(error) }
  }
}
