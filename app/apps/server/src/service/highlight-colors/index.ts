import { eq, max, sql } from 'drizzle-orm'

import type {
  HighlightColor,
  OperationResult,
  ReorderHighlightColorsInput,
  UpsertHighlightColorInput,
} from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { highlightColors } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [highlight-colors] ${message}`)
}

/**
 * Converts database record to API format
 */
function toHighlightColor(
  record: typeof highlightColors.$inferSelect,
): HighlightColor {
  return {
    id: record.id,
    name: record.name,
    color: record.color,
    textColor: record.textColor,
    sortOrder: record.sortOrder,
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
 * Gets all highlight colors ordered by sortOrder
 */
export function getAllHighlightColors(): HighlightColor[] {
  try {
    log('debug', 'Getting all highlight colors')

    const db = getDatabase()
    const records = db
      .select()
      .from(highlightColors)
      .orderBy(highlightColors.sortOrder)
      .all()

    return records.map(toHighlightColor)
  } catch (error) {
    log('error', `Failed to get all highlight colors: ${error}`)
    return []
  }
}

/**
 * Gets a highlight color by ID
 */
export function getHighlightColorById(id: number): HighlightColor | null {
  try {
    log('debug', `Getting highlight color by ID: ${id}`)

    const db = getDatabase()
    const record = db
      .select()
      .from(highlightColors)
      .where(eq(highlightColors.id, id))
      .get()

    if (!record) {
      log('debug', `Highlight color not found: ${id}`)
      return null
    }

    return toHighlightColor(record)
  } catch (error) {
    log('error', `Failed to get highlight color: ${error}`)
    return null
  }
}

/**
 * Creates or updates a highlight color
 */
export function upsertHighlightColor(
  input: UpsertHighlightColorInput,
): HighlightColor | null {
  try {
    const db = getDatabase()

    if (input.id) {
      log('debug', `Updating highlight color: ${input.id}`)

      const updateData: Partial<typeof highlightColors.$inferInsert> = {
        updatedAt: sql`(unixepoch())` as unknown as Date,
      }

      if (input.name !== undefined) {
        updateData.name = input.name
      }
      if (input.color !== undefined) {
        updateData.color = input.color
      }
      if (input.textColor !== undefined) {
        updateData.textColor = input.textColor
      }
      if (input.sortOrder !== undefined) {
        updateData.sortOrder = input.sortOrder
      }

      db.update(highlightColors)
        .set(updateData)
        .where(eq(highlightColors.id, input.id))
        .run()

      log('info', `Highlight color updated: ${input.id}`)
      return getHighlightColorById(input.id)
    }

    // For new colors, calculate next sortOrder (max + 1)
    const result = db
      .select({ maxSortOrder: max(highlightColors.sortOrder) })
      .from(highlightColors)
      .get()

    const nextSortOrder = input.sortOrder ?? (result?.maxSortOrder ?? -1) + 1

    log(
      'debug',
      `Creating highlight color: ${input.name} with sortOrder: ${nextSortOrder}`,
    )

    const inserted = db
      .insert(highlightColors)
      .values({
        name: input.name,
        color: input.color,
        textColor: input.textColor ?? '#000000',
        sortOrder: nextSortOrder,
      })
      .returning({ id: highlightColors.id })
      .get()

    log('info', `Highlight color created: ${inserted.id}`)
    return getHighlightColorById(inserted.id)
  } catch (error) {
    log('error', `Failed to upsert highlight color: ${error}`)
    return null
  }
}

/**
 * Deletes a highlight color
 */
export function deleteHighlightColor(id: number): OperationResult {
  try {
    log('debug', `Deleting highlight color: ${id}`)

    const db = getDatabase()
    db.delete(highlightColors).where(eq(highlightColors.id, id)).run()

    log('info', `Highlight color deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete highlight color: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Reorders highlight colors by updating their sortOrder based on array order
 */
export function reorderHighlightColors(
  input: ReorderHighlightColorsInput,
): OperationResult {
  try {
    log('debug', `Reordering ${input.colorIds.length} highlight colors`)

    const rawDb = getRawDatabase()

    rawDb.exec('BEGIN TRANSACTION')

    try {
      const db = getDatabase()

      for (let i = 0; i < input.colorIds.length; i++) {
        const id = input.colorIds[i]
        const sortOrder = i

        db.update(highlightColors)
          .set({
            sortOrder,
            updatedAt: sql`(unixepoch())` as unknown as Date,
          })
          .where(eq(highlightColors.id, id))
          .run()
      }

      rawDb.exec('COMMIT')
      log('info', 'Highlight colors reordered successfully')
      return { success: true }
    } catch (error) {
      rawDb.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to reorder highlight colors: ${error}`)
    return { success: false, error: String(error) }
  }
}

export type { HighlightColor, UpsertHighlightColorInput, OperationResult }
