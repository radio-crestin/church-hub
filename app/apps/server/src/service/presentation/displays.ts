import type {
  Display,
  DisplayOpenMode,
  DisplayRecord,
  DisplayTheme,
  OperationResult,
  UpsertDisplayInput,
} from './types'
import { getDefaultTheme } from './types'
import { getDatabase } from '../../db'

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
function toDisplay(record: DisplayRecord): Display {
  return {
    id: record.id,
    name: record.name,
    isActive: record.is_active === 1,
    openMode: (record.open_mode as DisplayOpenMode) || 'browser',
    isFullscreen: record.is_fullscreen === 1,
    theme: parseTheme(record.theme),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all displays
 */
export function getAllDisplays(): Display[] {
  try {
    log('debug', 'Getting all displays')

    const db = getDatabase()
    const query = db.query('SELECT * FROM displays ORDER BY created_at ASC')
    const records = query.all() as DisplayRecord[]

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
    const query = db.query(
      'SELECT * FROM displays WHERE is_active = 1 ORDER BY created_at ASC',
    )
    const records = query.all() as DisplayRecord[]

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
    const query = db.query('SELECT * FROM displays WHERE id = ?')
    const record = query.get(id) as DisplayRecord | null

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
    const now = Math.floor(Date.now() / 1000)
    const themeJson = JSON.stringify(input.theme ?? getDefaultTheme())
    const openMode = input.openMode ?? 'browser'
    const isFullscreen = input.isFullscreen === true ? 1 : 0

    if (input.id) {
      // Update existing display
      log('debug', `Updating display: ${input.id}`)

      const query = db.query(`
        UPDATE displays
        SET name = ?, is_active = ?, open_mode = ?, is_fullscreen = ?, theme = ?, updated_at = ?
        WHERE id = ?
      `)
      query.run(
        input.name,
        input.isActive !== false ? 1 : 0,
        openMode,
        isFullscreen,
        themeJson,
        now,
        input.id,
      )

      log('info', `Display updated: ${input.id}`)
      return getDisplayById(input.id)
    }

    // Create new display
    log('debug', `Creating display: ${input.name}`)

    const insertQuery = db.query(`
      INSERT INTO displays (name, is_active, open_mode, is_fullscreen, theme, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    insertQuery.run(
      input.name,
      input.isActive !== false ? 1 : 0,
      openMode,
      isFullscreen,
      themeJson,
      now,
      now,
    )

    // Get the inserted ID
    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id } = getLastId.get() as { id: number }

    log('info', `Display created: ${id}`)
    return getDisplayById(id)
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
    const query = db.query('DELETE FROM displays WHERE id = ?')
    query.run(id)

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
    const now = Math.floor(Date.now() / 1000)
    const themeJson = JSON.stringify(theme)

    const query = db.query(`
      UPDATE displays
      SET theme = ?, updated_at = ?
      WHERE id = ?
    `)
    query.run(themeJson, now, id)

    log('info', `Display theme updated: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update display theme: ${error}`)
    return { success: false, error: String(error) }
  }
}
