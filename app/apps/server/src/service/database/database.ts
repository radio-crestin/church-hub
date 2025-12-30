import { stat, unlink, writeFile } from 'node:fs/promises'
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
 * Exports the database to the specified path using SQLite's serialize API
 * This properly handles WAL mode by capturing the complete database state
 */
export async function checkpointAndExport(
  destinationPath: string,
): Promise<ExportResult> {
  try {
    const sqlite = getRawDatabase()

    // Checkpoint WAL first to ensure all writes are in main file
    sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)')

    // Use serialize() to get the complete database state as bytes
    // This properly handles WAL mode and captures all data
    const serialized = sqlite.serialize()

    // Write the serialized database to the destination
    await writeFile(destinationPath, serialized)

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

    // 3. Open source database and serialize it to capture all data including WAL
    // This handles cases where the source database has uncommitted WAL data
    let sourceData: Uint8Array
    try {
      const sourceDb = new Database(sourcePath, { readonly: true })
      // Serialize captures the complete database state including WAL
      sourceData = sourceDb.serialize()
      sourceDb.close()
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read source database',
        requiresRestart: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    // 4. Backup current database before replacing
    const currentSqlite = getRawDatabase()
    try {
      currentSqlite.run('PRAGMA wal_checkpoint(TRUNCATE)')
      const backupData = currentSqlite.serialize()
      await writeFile(backupPath, backupData)
    } catch {
      // If backup fails, it might be because the database is new/empty
      // Continue anyway
    }

    // 5. Close current database connection
    closeDatabase()

    // 6. Remove old WAL and SHM files if they exist
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

    // 7. Write the serialized source database to destination
    await writeFile(destPath, sourceData)

    // 8. Reinitialize the database connection with the new database
    try {
      await initializeDatabase()
    } catch (error) {
      // If reinitialization fails, try to restore from backup
      console.error('[database] Failed to reinitialize, restoring backup:', error)
      try {
        const backupFile = Bun.file(backupPath)
        if (await backupFile.exists()) {
          const backupData = new Uint8Array(await backupFile.arrayBuffer())
          await writeFile(destPath, backupData)
          await initializeDatabase()
        }
      } catch (restoreError) {
        console.error('[database] Failed to restore backup:', restoreError)
      }
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
