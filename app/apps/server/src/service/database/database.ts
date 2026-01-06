import { copyFile, stat, unlink } from 'node:fs/promises'

import { Database } from 'bun:sqlite'
import {
  closeDatabase,
  getRawDatabase,
  initializeDatabase,
} from '../../db/connection'
import { getDatabasePath, getDataDir } from '../../utils/paths'
import { rebuildSearchIndex as rebuildBibleSearchIndex } from '../bible/search'
import { rebuildScheduleSearchIndex } from '../schedules/search'
import { rebuildSearchIndex as rebuildSongsSearchIndex } from '../songs/search'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [database] ${message}`)
}

export interface DatabaseInfo {
  path: string
  dataDir: string
  sizeBytes: number
}

export interface ExportResult {
  success: boolean
  exportedPath: string
  error?: string
}

export interface ImportResult {
  success: boolean
  message: string
  requiresRestart: boolean
  error?: string
}

export interface ImportOptions {
  songs: boolean
  bible: boolean
  schedules: boolean
  configurations: boolean
}

/**
 * Gets information about the current database
 */
export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  const path = getDatabasePath()
  const dataDir = getDataDir()

  let sizeBytes = 0
  try {
    const stats = await stat(path)
    sizeBytes = stats.size
  } catch {
    // File might not exist yet
  }

  return {
    path,
    dataDir,
    sizeBytes,
  }
}

/**
 * Exports the database to the specified path using file copy
 * This properly handles WAL mode by checkpointing first to ensure all data is in main file
 * Uses streaming file copy to avoid loading entire database into memory
 */
export async function checkpointAndExport(
  destinationPath: string,
): Promise<ExportResult> {
  try {
    const sqlite = getRawDatabase()
    const sourcePath = getDatabasePath()

    // Checkpoint WAL first to ensure all writes are in main file
    sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)')

    // Use file copy instead of serialize() to avoid loading entire database into memory
    // This streams the file instead of loading it all at once
    await copyFile(sourcePath, destinationPath)

    return {
      success: true,
      exportedPath: destinationPath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      exportedPath: destinationPath,
      error: message,
    }
  }
}

/**
 * Validates that a file is a valid SQLite database by checking the header
 * We can't use PRAGMA integrity_check because WAL-mode databases fail in readonly mode
 */
async function validateSqliteDatabase(filePath: string): Promise<boolean> {
  try {
    // SQLite files start with "SQLite format 3\0"
    const file = Bun.file(filePath)
    const header = await file.slice(0, 16).text()
    return header.startsWith('SQLite format 3')
  } catch {
    return false
  }
}

/**
 * Imports a database from the specified path, replacing the current database
 * Creates a backup of the current database before replacing
 * Properly handles WAL mode by serializing the source database
 */
export async function importDatabase(
  sourcePath: string,
): Promise<ImportResult> {
  const destPath = getDatabasePath()
  const backupPath = `${destPath}.backup`

  try {
    // 1. Validate source file exists
    try {
      await stat(sourcePath)
    } catch {
      return {
        success: false,
        message: 'Source file not found',
        requiresRestart: false,
        error: 'Source file does not exist',
      }
    }

    // 2. Validate source is a valid SQLite database
    const isValid = await validateSqliteDatabase(sourcePath)
    if (!isValid) {
      return {
        success: false,
        message: 'Invalid database file',
        requiresRestart: false,
        error: 'The selected file is not a valid SQLite database',
      }
    }

    // 3. If source has WAL file, try to checkpoint it (requires write access)
    // Skip if readonly or no WAL - exported backups typically don't have WAL files
    const sourceWalPath = `${sourcePath}-wal`
    try {
      const walExists = await Bun.file(sourceWalPath).exists()
      if (walExists) {
        // Only attempt checkpoint if WAL exists and we can open with write access
        try {
          const sourceDb = new Database(sourcePath)
          sourceDb.run('PRAGMA wal_checkpoint(TRUNCATE)')
          sourceDb.close()
        } catch {
          // If checkpoint fails (readonly file), just copy the files as-is
        }
      }
    } catch {
      // Ignore WAL check errors
    }

    // 4. Backup current database before replacing using file copy (no memory issues)
    const currentSqlite = getRawDatabase()
    try {
      currentSqlite.run('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      // If checkpoint fails, continue anyway
    }

    // 5. Close current database connection before file operations
    closeDatabase()

    // 6. Create backup using streaming file copy (avoids loading into memory)
    try {
      await copyFile(destPath, backupPath)
    } catch {
      // If backup fails, it might be because the database is new/empty
      // Continue anyway
    }

    // 7. Remove old WAL and SHM files if they exist
    try {
      await unlink(`${destPath}-wal`)
    } catch {
      // File might not exist
    }
    try {
      await unlink(`${destPath}-shm`)
    } catch {
      // File might not exist
    }

    // 8. Copy source database to destination using streaming file copy
    // This avoids loading the entire database into memory
    await copyFile(sourcePath, destPath)

    // 9. Reinitialize the database connection with the new database
    try {
      await initializeDatabase()
    } catch (error) {
      // Restore from backup using file copy (no memory issues)
      try {
        const backupFile = Bun.file(backupPath)
        if (await backupFile.exists()) {
          await copyFile(backupPath, destPath)
          await initializeDatabase()
        }
      } catch (_restoreError) {}
      return {
        success: false,
        message: 'Failed to initialize imported database',
        requiresRestart: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    return {
      success: true,
      message: 'Database imported successfully.',
      requiresRestart: false, // No restart needed - we reinitialized in-process
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: 'Failed to import database',
      requiresRestart: false,
      error: message,
    }
  }
}

/**
 * Table groups for selective import
 */
const IMPORT_TABLES = {
  songs: ['song_categories', 'songs', 'song_slides'],
  bible: ['bible_translations', 'bible_books', 'bible_verses'],
  schedules: [
    'schedules',
    'schedule_items',
    'schedule_bible_passage_verses',
    'schedule_versete_tineri_entries',
  ],
  configurations: [
    'screens',
    'screen_content_configs',
    'screen_next_slide_configs',
    'app_settings',
    'user_preferences',
    'cache_metadata',
    'bible_history',
  ],
} as const

/**
 * Imports selected data categories from a source database
 * Does not replace the entire database, only imports selected tables
 * Uses transactions and disables foreign keys for performance
 */
export async function selectiveImportDatabase(
  sourcePath: string,
  options: ImportOptions,
): Promise<ImportResult> {
  const startTime = performance.now()

  try {
    // 1. Validate source file exists
    try {
      await stat(sourcePath)
    } catch {
      return {
        success: false,
        message: 'Source file not found',
        requiresRestart: false,
        error: 'Source file does not exist',
      }
    }

    // 2. Validate source is a valid SQLite database
    const isValid = await validateSqliteDatabase(sourcePath)
    if (!isValid) {
      return {
        success: false,
        message: 'Invalid database file',
        requiresRestart: false,
        error: 'The selected file is not a valid SQLite database',
      }
    }

    // 3. Validate at least one category is selected
    const hasSelection =
      options.songs ||
      options.bible ||
      options.schedules ||
      options.configurations
    if (!hasSelection) {
      return {
        success: false,
        message: 'No categories selected',
        requiresRestart: false,
        error: 'Please select at least one category to import',
      }
    }

    // 4. If source has WAL file, try to checkpoint it
    const sourceWalPath = `${sourcePath}-wal`
    try {
      const walExists = await Bun.file(sourceWalPath).exists()
      if (walExists) {
        try {
          const sourceDb = new Database(sourcePath)
          sourceDb.run('PRAGMA wal_checkpoint(TRUNCATE)')
          sourceDb.close()
        } catch {
          // If checkpoint fails (readonly file), continue anyway
        }
      }
    } catch {
      // Ignore WAL check errors
    }

    // 5. Open source database as readonly
    log('info', `Opening source database: ${sourcePath}`)
    const sourceDb = new Database(sourcePath, { readonly: true })

    // 6. Get current database connection
    const destDb = getRawDatabase()

    // 7. Build list of tables to import
    const tablesToImport: string[] = []
    if (options.songs) tablesToImport.push(...IMPORT_TABLES.songs)
    if (options.bible) tablesToImport.push(...IMPORT_TABLES.bible)
    if (options.schedules) tablesToImport.push(...IMPORT_TABLES.schedules)
    if (options.configurations)
      tablesToImport.push(...IMPORT_TABLES.configurations)

    log('info', `Importing tables: ${tablesToImport.join(', ')}`)

    // 8. Begin transaction and disable foreign keys for performance
    destDb.run('PRAGMA foreign_keys = OFF')
    destDb.run('BEGIN TRANSACTION')

    try {
      for (const tableName of tablesToImport) {
        // Check if table exists in source
        const tableExists = sourceDb
          .query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          )
          .get(tableName)

        if (!tableExists) {
          log('debug', `Table ${tableName} not found in source, skipping`)
          continue
        }

        // Get column names from source table
        const columns = sourceDb
          .query(`PRAGMA table_info(${tableName})`)
          .all() as Array<{ name: string }>
        const columnNames = columns.map((c) => c.name)

        if (columnNames.length === 0) {
          log('debug', `Table ${tableName} has no columns, skipping`)
          continue
        }

        // Delete existing data in destination
        log('debug', `Deleting existing data from ${tableName}`)
        destDb.run(`DELETE FROM ${tableName}`)

        // Read all rows from source
        const rows = sourceDb.query(`SELECT * FROM ${tableName}`).all()

        if (rows.length === 0) {
          log('debug', `Table ${tableName} is empty in source`)
          continue
        }

        // Build insert statement
        const placeholders = columnNames.map(() => '?').join(', ')
        const insertSql = `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`
        const insertStmt = destDb.prepare(insertSql)

        // Insert rows in batches
        log('debug', `Inserting ${rows.length} rows into ${tableName}`)
        for (const row of rows) {
          const values = columnNames.map(
            (col) => (row as Record<string, unknown>)[col],
          )
          insertStmt.run(...values)
        }
      }

      // 9. Commit transaction
      destDb.run('COMMIT')
      log('info', 'Transaction committed successfully')

      // 10. Re-enable foreign keys
      destDb.run('PRAGMA foreign_keys = ON')

      // 11. Close source database
      sourceDb.close()

      // 12. Rebuild FTS indexes for imported categories
      log('info', 'Rebuilding search indexes for imported data...')
      if (options.songs) {
        log('debug', 'Rebuilding songs FTS index')
        rebuildSongsSearchIndex()
      }
      if (options.schedules) {
        log('debug', 'Rebuilding schedules FTS index')
        rebuildScheduleSearchIndex()
      }
      if (options.bible) {
        log('debug', 'Rebuilding Bible FTS index')
        rebuildBibleSearchIndex()
      }

      const duration = performance.now() - startTime
      log('info', `Selective import completed in ${duration.toFixed(2)}ms`)

      return {
        success: true,
        message: 'Data imported successfully.',
        requiresRestart: false,
      }
    } catch (error) {
      // Rollback on error
      try {
        destDb.run('ROLLBACK')
      } catch {
        // Ignore rollback errors
      }
      destDb.run('PRAGMA foreign_keys = ON')
      sourceDb.close()
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('error', `Selective import failed: ${message}`)
    return {
      success: false,
      message: 'Failed to import data',
      requiresRestart: false,
      error: message,
    }
  }
}
