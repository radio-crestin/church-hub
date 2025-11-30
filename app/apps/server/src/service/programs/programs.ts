import { getSlidesByProgramId } from './slides'
import type {
  OperationResult,
  Program,
  ProgramRecord,
  ProgramWithSlides,
  UpsertProgramInput,
} from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [programs] ${message}`)
}

/**
 * Converts database program record to API format
 */
function toProgram(record: ProgramRecord): Program {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all programs
 */
export function getAllPrograms(): Program[] {
  try {
    log('debug', 'Getting all programs')

    const db = getDatabase()
    const query = db.query('SELECT * FROM programs ORDER BY created_at DESC')
    const records = query.all() as ProgramRecord[]

    return records.map(toProgram)
  } catch (error) {
    log('error', `Failed to get all programs: ${error}`)
    return []
  }
}

/**
 * Gets a program by ID
 */
export function getProgramById(id: number): Program | null {
  try {
    log('debug', `Getting program by ID: ${id}`)

    const db = getDatabase()
    const query = db.query('SELECT * FROM programs WHERE id = ?')
    const record = query.get(id) as ProgramRecord | null

    if (!record) {
      log('debug', `Program not found: ${id}`)
      return null
    }

    return toProgram(record)
  } catch (error) {
    log('error', `Failed to get program: ${error}`)
    return null
  }
}

/**
 * Gets a program by ID with all its slides
 */
export function getProgramWithSlides(id: number): ProgramWithSlides | null {
  try {
    log('debug', `Getting program with slides: ${id}`)

    const program = getProgramById(id)
    if (!program) {
      return null
    }

    const slides = getSlidesByProgramId(id)

    return {
      ...program,
      slides,
    }
  } catch (error) {
    log('error', `Failed to get program with slides: ${error}`)
    return null
  }
}

/**
 * Creates or updates a program
 */
export function upsertProgram(input: UpsertProgramInput): Program | null {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    if (input.id) {
      // Update existing program
      log('debug', `Updating program: ${input.id}`)

      const query = db.query(`
        UPDATE programs
        SET name = ?, description = ?, updated_at = ?
        WHERE id = ?
      `)
      query.run(input.name, input.description ?? null, now, input.id)

      log('info', `Program updated: ${input.id}`)
      return getProgramById(input.id)
    }

    // Create new program
    log('debug', `Creating program: ${input.name}`)

    const insertQuery = db.query(`
      INSERT INTO programs (name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    insertQuery.run(input.name, input.description ?? null, now, now)

    // Get the inserted ID
    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id } = getLastId.get() as { id: number }

    log('info', `Program created: ${id}`)
    return getProgramById(id)
  } catch (error) {
    log('error', `Failed to upsert program: ${error}`)
    return null
  }
}

/**
 * Deletes a program and all its slides (cascading)
 */
export function deleteProgram(id: number): OperationResult {
  try {
    log('debug', `Deleting program: ${id}`)

    const db = getDatabase()

    // Slides are deleted automatically via CASCADE
    const query = db.query('DELETE FROM programs WHERE id = ?')
    query.run(id)

    log('info', `Program deleted: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete program: ${error}`)
    return { success: false, error: String(error) }
  }
}
