import { copyFile, stat, unlink } from 'node:fs/promises'

import { closeDatabase, getRawDatabase } from '../../db/connection'
import { getDatabasePath, getDataDir } from '../../utils/paths'

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
 * Checkpoints the WAL and exports the database to the specified path
 * WAL checkpoint ensures all pending writes are flushed to the main db file
 */
export async function checkpointAndExport(
  destinationPath: string,
): Promise<ExportResult> {
  const sourcePath = getDatabasePath()

  try {
    // Run WAL checkpoint to flush all pending writes to main database file
    const sqlite = getRawDatabase()
    sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)')

    // Copy the database file to destination
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
 * Requires app restart after successful import
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

    // 3. Checkpoint current WAL to flush pending writes
    const sqlite = getRawDatabase()
    sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)')

    // 4. Close current database connection
    closeDatabase()

    // 5. Backup current database
    try {
      await copyFile(destPath, backupPath)
    } catch {
      // If backup fails, it might be because the file doesn't exist yet
      // Continue anyway
    }

    // 6. Remove WAL and SHM files if they exist
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

    // 7. Copy source file to database path
    await copyFile(sourcePath, destPath)

    return {
      success: true,
      message:
        'Database imported successfully. Please restart the application.',
      requiresRestart: true,
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
