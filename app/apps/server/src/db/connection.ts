import { existsSync, readdirSync, unlinkSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
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

const MAX_VERSION_BACKUPS = 3
const VERSION_BACKUP_PATTERN = /^app-v(.+)\.db$/

/**
 * Creates a versioned database backup before migrations run.
 * On first launch of a new version, copies the current app.db to app-v{version}.db.
 * Keeps only the latest MAX_VERSION_BACKUPS versioned files, deleting older ones.
 */
function getAppVersion(): string | null {
  if (process.env.APP_VERSION) return process.env.APP_VERSION

  // Fallback: read version from tauri.conf.json (dev mode)
  try {
    // This file is at: apps/server/src/db/connection.ts
    // Monorepo root is at: ../../../../ (apps/server/src/db -> app/)
    // tauri.conf.json is at: app/tauri/tauri.conf.json
    const tauriConfPath = join(
      import.meta.dir,
      '..',
      '..',
      '..',
      '..',
      'tauri',
      'tauri.conf.json',
    )
    const content = require('node:fs').readFileSync(tauriConfPath, 'utf8')
    const conf = JSON.parse(content)
    return conf.version || null
  } catch {
    return null
  }
}

async function createVersionBackup(dbPath: string): Promise<void> {
  const version = getAppVersion()
  if (!version) {
    log('debug', 'Could not determine app version, skipping version backup')
    return
  }

  const dbDir = dirname(dbPath)
  const versionedFile = join(dbDir, `app-v${version}.db`)

  // If this version's backup already exists, nothing to do
  if (existsSync(versionedFile)) {
    log('debug', `Version backup already exists: ${versionedFile}`)
    cleanupOldVersionBackups(dbDir)
    return
  }

  // Copy current database (if it exists) to the versioned backup
  if (existsSync(dbPath)) {
    try {
      // Checkpoint WAL to ensure the main db file is up-to-date
      const tempDb = new Database(dbPath, { readonly: true })
      try {
        tempDb.run('PRAGMA wal_checkpoint(TRUNCATE)')
      } catch {
        // WAL checkpoint may fail if no WAL exists — that's fine
      }
      tempDb.close()

      await copyFile(dbPath, versionedFile)
      log('info', `Created version backup: app-v${version}.db`)
    } catch (err) {
      log('warning', `Failed to create version backup: ${err}`)
    }
  } else {
    log('debug', 'No existing database to back up (fresh install)')
  }

  cleanupOldVersionBackups(dbDir)
}

/**
 * Removes old versioned backups, keeping only the latest MAX_VERSION_BACKUPS.
 * Sorts by file modification time (most recent first).
 */
function cleanupOldVersionBackups(dbDir: string): void {
  try {
    const files = readdirSync(dbDir)
      .filter((f) => VERSION_BACKUP_PATTERN.test(f))
      .map((f) => ({
        name: f,
        path: join(dbDir, f),
        mtime: Bun.file(join(dbDir, f)).lastModified,
      }))
      .sort((a, b) => b.mtime - a.mtime)

    if (files.length <= MAX_VERSION_BACKUPS) return

    for (const file of files.slice(MAX_VERSION_BACKUPS)) {
      log('info', `Removing old version backup: ${file.name}`)
      unlinkSync(file.path)
      // Also remove WAL/SHM files if they exist
      for (const suffix of ['-wal', '-shm']) {
        const sideFile = `${file.path}${suffix}`
        if (existsSync(sideFile)) unlinkSync(sideFile)
      }
    }
  } catch (err) {
    log('warning', `Failed to clean up old version backups: ${err}`)
  }
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

    // Create versioned backup before migrations modify the database
    t = performance.now()
    await createVersionBackup(DATABASE_PATH)
    logTiming('db_version_backup', t)

    // Create database connection using Bun's built-in SQLite
    t = performance.now()
    sqlite = new Database(DATABASE_PATH, { create: true })
    logTiming('sqlite_connect', t)

    // Enable WAL mode for better concurrency
    t = performance.now()
    sqlite.run('PRAGMA journal_mode = WAL')

    // Enable foreign keys
    sqlite.run('PRAGMA foreign_keys = ON')

    // Set busy timeout to 15 seconds so queries waiting for a lock
    // will retry rather than fail immediately
    sqlite.run('PRAGMA busy_timeout = 15000')

    // RAM optimizations for better performance on slow machines
    // 64MB page cache (negative value = KB)
    sqlite.run('PRAGMA cache_size = -65536')
    // Store temporary tables and indexes in memory
    sqlite.run('PRAGMA temp_store = MEMORY')
    // 256MB memory-mapped I/O for faster file access
    sqlite.run('PRAGMA mmap_size = 268435456')
    // NORMAL sync is safe with WAL and faster than FULL
    sqlite.run('PRAGMA synchronous = NORMAL')
    // Allow readers to proceed without acquiring shared locks, so SELECT
    // queries never block writes and long writes never block reads
    sqlite.run('PRAGMA read_uncommitted = ON')

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
