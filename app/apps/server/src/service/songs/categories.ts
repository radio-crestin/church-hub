import type {
  OperationResult,
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
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all song categories
 */
export function getAllCategories(): SongCategory[] {
  try {
    log('debug', 'Getting all categories')

    const db = getDatabase()
    const query = db.query('SELECT * FROM song_categories ORDER BY name ASC')
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

      const query = db.query(`
        UPDATE song_categories
        SET name = ?, updated_at = ?
        WHERE id = ?
      `)
      query.run(input.name, now, input.id)

      log('info', `Category updated: ${input.id}`)
      return getCategoryById(input.id)
    }

    log('debug', `Creating category: ${input.name}`)

    const insertQuery = db.query(`
      INSERT INTO song_categories (name, created_at, updated_at)
      VALUES (?, ?, ?)
    `)
    insertQuery.run(input.name, now, now)

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
 * Deletes a category (songs with this category will have category_id set to NULL)
 */
export function deleteCategory(id: number): OperationResult {
  try {
    log('debug', `Deleting category: ${id}`)

    const db = getDatabase()
    const query = db.query('DELETE FROM song_categories WHERE id = ?')
    query.run(id)

    log('info', `Category deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete category: ${error}`)
    return { success: false, error: String(error) }
  }
}
