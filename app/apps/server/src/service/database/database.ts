import { copyFile, stat } from 'node:fs/promises'

import { getRawDatabase } from '../../db/connection'
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
