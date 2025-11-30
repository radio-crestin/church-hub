import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'
const DATABASE_PATH = process.env.DATABASE_PATH || './data/app.db'

let db: Database | null = null

/**
 * Logs debug messages if DEBUG env variable is enabled
 */
function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
}

/**
 * Initializes the SQLite database connection
 * Creates the data directory if it doesn't exist
 */
export async function initializeDatabase(): Promise<Database> {
  try {
    log('info', `Initializing database at: ${DATABASE_PATH}`)

    // Ensure data directory exists
    const dbDir = dirname(DATABASE_PATH)
    await mkdir(dbDir, { recursive: true })
    log('debug', `Data directory ensured: ${dbDir}`)

    // Create database connection using Bun's built-in SQLite
    db = new Database(DATABASE_PATH, { create: true })

    // Enable WAL mode for better concurrency
    db.run('PRAGMA journal_mode = WAL')

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON')

    log('info', 'Database connection established')
    return db
  } catch (error) {
    log('error', `Failed to initialize database: ${error}`)
    throw error
  }
}

/**
 * Returns the active database connection
 * Throws if database is not initialized
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    )
  }
  return db
}

/**
 * Closes the database connection
 */
export function closeDatabase(): void {
  if (db) {
    log('info', 'Closing database connection')
    db.close()
    db = null
  }
}
