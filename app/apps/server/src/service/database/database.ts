import { copyFile, stat, unlink } from 'node:fs/promises'

import { Database } from 'bun:sqlite'
import {
  closeDatabase,
  getRawDatabase,
  initializeDatabase,
} from '../../db/connection'
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

    // 3. Checkpoint WAL on source database to ensure all data is in main file
    // Then close it so we can copy the file
    try {
      const sourceDb = new Database(sourcePath, { readonly: true })
      // Checkpoint merges WAL data into main database file
      sourceDb.run('PRAGMA wal_checkpoint(TRUNCATE)')
      sourceDb.close()
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read source database',
        requiresRestart: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
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
