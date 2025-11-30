import type {
  OperationResult,
  ReorderSlidesInput,
  Slide,
  SlideContent,
  SlideRecord,
  SlideType,
  UpsertSlideInput,
} from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [slides] ${message}`)
}

/**
 * Parses slide content JSON safely
 */
function parseSlideContent(contentJson: string): SlideContent {
  try {
    return JSON.parse(contentJson) as SlideContent
  } catch {
    return { type: 'custom', html: '', autoFitText: true }
  }
}

/**
 * Converts database slide record to API format
 */
function toSlide(record: SlideRecord): Slide {
  return {
    id: record.id,
    programId: record.program_id,
    type: record.type as SlideType,
    content: parseSlideContent(record.content),
    sortOrder: record.sort_order,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all slides for a program
 */
export function getSlidesByProgramId(programId: number): Slide[] {
  try {
    log('debug', `Getting slides for program: ${programId}`)

    const db = getDatabase()
    const query = db.query(
      'SELECT * FROM slides WHERE program_id = ? ORDER BY sort_order ASC',
    )
    const records = query.all(programId) as SlideRecord[]

    return records.map(toSlide)
  } catch (error) {
    log('error', `Failed to get slides: ${error}`)
    return []
  }
}

/**
 * Gets a slide by ID
 */
export function getSlideById(id: number): Slide | null {
  try {
    log('debug', `Getting slide by ID: ${id}`)

    const db = getDatabase()
    const query = db.query('SELECT * FROM slides WHERE id = ?')
    const record = query.get(id) as SlideRecord | null

    if (!record) {
      log('debug', `Slide not found: ${id}`)
      return null
    }

    return toSlide(record)
  } catch (error) {
    log('error', `Failed to get slide: ${error}`)
    return null
  }
}

/**
 * Gets the next sort order for a program
 */
function getNextSortOrder(programId: number): number {
  const db = getDatabase()
  const query = db.query(
    'SELECT MAX(sort_order) as max_order FROM slides WHERE program_id = ?',
  )
  const result = query.get(programId) as { max_order: number | null }
  return (result.max_order ?? -1) + 1
}

/**
 * Creates or updates a slide
 */
export function upsertSlide(input: UpsertSlideInput): Slide | null {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const contentJson = JSON.stringify(input.content)

    if (input.id) {
      // Update existing slide
      log('debug', `Updating slide: ${input.id}`)

      const query = db.query(`
        UPDATE slides
        SET type = ?, content = ?, updated_at = ?
        WHERE id = ?
      `)
      query.run(input.type ?? 'custom', contentJson, now, input.id)

      log('info', `Slide updated: ${input.id}`)
      return getSlideById(input.id)
    }

    // Create new slide
    log('debug', `Creating slide for program: ${input.programId}`)

    const sortOrder = input.sortOrder ?? getNextSortOrder(input.programId)

    const insertQuery = db.query(`
      INSERT INTO slides (program_id, type, content, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    insertQuery.run(
      input.programId,
      input.type ?? 'custom',
      contentJson,
      sortOrder,
      now,
      now,
    )

    // Get the inserted ID
    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id } = getLastId.get() as { id: number }

    log('info', `Slide created: ${id}`)
    return getSlideById(id)
  } catch (error) {
    log('error', `Failed to upsert slide: ${error}`)
    return null
  }
}

/**
 * Deletes a slide
 */
export function deleteSlide(id: number): OperationResult {
  try {
    log('debug', `Deleting slide: ${id}`)

    const db = getDatabase()
    const query = db.query('DELETE FROM slides WHERE id = ?')
    query.run(id)

    log('info', `Slide deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete slide: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Reorders slides within a program
 * Updates sort_order based on the order of slideIds array
 */
export function reorderSlides(
  programId: number,
  input: ReorderSlidesInput,
): OperationResult {
  try {
    log('debug', `Reordering slides for program: ${programId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    const updateQuery = db.query(`
      UPDATE slides
      SET sort_order = ?, updated_at = ?
      WHERE id = ? AND program_id = ?
    `)

    for (let i = 0; i < input.slideIds.length; i++) {
      updateQuery.run(i, now, input.slideIds[i], programId)
    }

    log('info', `Slides reordered for program: ${programId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to reorder slides: ${error}`)
    return { success: false, error: String(error) }
  }
}
