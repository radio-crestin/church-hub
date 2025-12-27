import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite'

import { type MigrationResult, runMigrations } from './migrations'
import * as schema from './schema'
import { Database } from 'bun:sqlite'
import { getDatabasePath } from '../utils/paths'

interface InitializeResult {
  db: BunSQLiteDatabase<typeof schema>
  migrationResult: MigrationResult
}

const DEBUG = process.env.DEBUG === 'true'
const DATABASE_PATH = getDatabasePath()

let sqlite: Database | null = null
let db: BunSQLiteDatabase<typeof schema> | null = null

/**
 * Logs debug messages if DEBUG env variable is enabled
 */
function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[db:${level}] ${message}`)
}

/**
 * Initializes the SQLite database connection with Drizzle ORM
 * Creates the data directory if it doesn't exist
 * Returns both the database instance and migration result
 */
export async function initializeDatabase(): Promise<InitializeResult> {
  const logTiming = (label: string, start: number) => {
    // biome-ignore lint/suspicious/noConsole: Startup timing logs
    console.log(
      `[startup] ${label}: ${(performance.now() - start).toFixed(1)}ms`,
    )
  }

  try {
    log('info', `Initializing database at: ${DATABASE_PATH}`)

    // Ensure data directory exists
    let t = performance.now()
    const dbDir = dirname(DATABASE_PATH)
    await mkdir(dbDir, { recursive: true })
    logTiming('db_mkdir', t)
    log('debug', `Data directory ensured: ${dbDir}`)

    // Create database connection using Bun's built-in SQLite
    t = performance.now()
    sqlite = new Database(DATABASE_PATH, { create: true })
    logTiming('sqlite_connect', t)

    // Enable WAL mode for better concurrency
    t = performance.now()
    sqlite.run('PRAGMA journal_mode = WAL')

    // Enable foreign keys
    sqlite.run('PRAGMA foreign_keys = ON')
    logTiming('sqlite_pragma', t)

    // Initialize Drizzle ORM with schema
    t = performance.now()
    db = drizzle(sqlite, { schema })
    logTiming('drizzle_init', t)

    log('info', 'Database connection established with Drizzle ORM')

    // Run migrations
    t = performance.now()
    const migrationResult = runMigrations(db, sqlite)
    logTiming('run_migrations', t)

    return { db, migrationResult }
  } catch (error) {
    log('error', `Failed to initialize database: ${error}`)
    throw error
  }
}

/**
 * Returns the active Drizzle database instance
 * Throws if database is not initialized
 */
export function getDatabase(): BunSQLiteDatabase<typeof schema> {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    )
  }
  return db
}

/**
 * Returns the raw SQLite database connection
 * Used for FTS operations that cannot be expressed via Drizzle
 * Throws if database is not initialized
 */
export function getRawDatabase(): Database {
  if (!sqlite) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    )
  }
  return sqlite
}

/**
 * Closes the database connection
 */
export function closeDatabase(): void {
  if (sqlite) {
    log('info', 'Closing database connection')
    sqlite.close()
    sqlite = null
    db = null
  }
}
