import { asc, eq, sql } from 'drizzle-orm'

import type {
  Display,
  DisplayOpenMode,
  DisplayTheme,
  OperationResult,
  UpsertDisplayInput,
} from './types'
import { getDefaultTheme } from './types'
import { getDatabase } from '../../db'
import { displays } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [displays] ${message}`)
}

/**
 * Parses display theme JSON safely
 */
function parseTheme(themeJson: string): DisplayTheme {
  try {
    const parsed = JSON.parse(themeJson) as Partial<DisplayTheme>
    return { ...getDefaultTheme(), ...parsed }
  } catch {
    return getDefaultTheme()
  }
}

/**
 * Converts database display record to API format
 */
function toDisplay(record: typeof displays.$inferSelect): Display {
  return {
    id: record.id,
    name: record.name,
    isActive: record.isActive,
    openMode: (record.openMode as DisplayOpenMode) || 'browser',
    isFullscreen: record.isFullscreen,
    theme: parseTheme(record.theme),
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
 * Gets all displays
 */
export function getAllDisplays(): Display[] {
  try {
    log('debug', 'Getting all displays')

    const db = getDatabase()
    const records = db
      .select()
      .from(displays)
      .orderBy(asc(displays.createdAt))
      .all()

    return records.map(toDisplay)
  } catch (error) {
    log('error', `Failed to get all displays: ${error}`)
    return []
  }
}

/**
 * Gets active displays only
 */
export function getActiveDisplays(): Display[] {
  try {
    log('debug', 'Getting active displays')

    const db = getDatabase()
    const records = db
      .select()
      .from(displays)
      .where(eq(displays.isActive, true))
      .orderBy(asc(displays.createdAt))
      .all()

    return records.map(toDisplay)
  } catch (error) {
    log('error', `Failed to get active displays: ${error}`)
    return []
  }
}

/**
 * Gets a display by ID
 */
export function getDisplayById(id: number): Display | null {
  try {
    log('debug', `Getting display by ID: ${id}`)

    const db = getDatabase()
    const record = db.select().from(displays).where(eq(displays.id, id)).get()

    if (!record) {
      log('debug', `Display not found: ${id}`)
      return null
    }

    return toDisplay(record)
  } catch (error) {
    log('error', `Failed to get display: ${error}`)
    return null
  }
}

/**
 * Creates or updates a display
 */
export function upsertDisplay(input: UpsertDisplayInput): Display | null {
  try {
    const db = getDatabase()
    const themeJson = JSON.stringify(input.theme ?? getDefaultTheme())
    const openMode = input.openMode ?? 'browser'

    if (input.id) {
      // Update existing display
      log('debug', `Updating display: ${input.id}`)

      db.update(displays)
        .set({
          name: input.name,
          isActive: input.isActive !== false,
          openMode,
          isFullscreen: input.isFullscreen === true,
          theme: themeJson,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(eq(displays.id, input.id))
        .run()

      log('info', `Display updated: ${input.id}`)
      return getDisplayById(input.id)
    }

    // Create new display
    log('debug', `Creating display: ${input.name}`)

    const inserted = db
      .insert(displays)
      .values({
        name: input.name,
        isActive: input.isActive !== false,
        openMode,
        isFullscreen: input.isFullscreen === true,
        theme: themeJson,
      })
      .returning({ id: displays.id })
      .get()

    log('info', `Display created: ${inserted.id}`)
    return getDisplayById(inserted.id)
  } catch (error) {
    log('error', `Failed to upsert display: ${error}`)
    return null
  }
}

/**
 * Deletes a display
 */
export function deleteDisplay(id: number): OperationResult {
  try {
    log('debug', `Deleting display: ${id}`)

    const db = getDatabase()
    db.delete(displays).where(eq(displays.id, id)).run()

    log('info', `Display deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete display: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Updates a display's theme
 */
export function updateDisplayTheme(
  id: number,
  theme: DisplayTheme,
): OperationResult {
  try {
    log('debug', `Updating theme for display: ${id}`)

    const db = getDatabase()
    const themeJson = JSON.stringify(theme)

    db.update(displays)
      .set({
        theme: themeJson,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(displays.id, id))
      .run()

    log('info', `Display theme updated: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update display theme: ${error}`)
    return { success: false, error: String(error) }
  }
}
