import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

import { downloadBackupToTemp } from './downloadBackupToTemp'
import { getDriveService, isInsufficientScopeError } from './getDriveService'
import { createLogger } from '../../utils/logger'
import { getDataDir } from '../../utils/paths'
import { importDatabase } from '../database'

const logger = createLogger('backup')

export interface RestoreBackupResult {
  success: boolean
  message: string
  requiresRestart: boolean
  requiresReconnect?: boolean
  error?: string
}

/**
 * Downloads a backup from the user's Google Drive app-data folder and restores
 * it, replacing the current database.
 *
 * The downloaded file is streamed to a temp file and then handed to
 * `importDatabase`, which validates the SQLite header, backs up the current
 * database, swaps the file and reinitializes the connection (auto-rolling back
 * on failure).
 */
export async function restoreBackup(
  fileId: string,
): Promise<RestoreBackupResult> {
  const drive = await getDriveService()
  if (!drive) {
    return {
      success: false,
      message: 'Not connected to Google Drive',
      requiresRestart: false,
      error: 'not_connected',
    }
  }

  const tempPath = join(getDataDir(), `.backup-restore-${Date.now()}.db`)

  try {
    await downloadBackupToTemp(drive, fileId, tempPath)

    logger.info(`Downloaded backup ${fileId}, restoring database`)
    const result = await importDatabase(tempPath)
    return {
      success: result.success,
      message: result.message,
      requiresRestart: result.requiresRestart,
      error: result.error,
    }
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      return {
        success: false,
        message: 'Google Drive access needs to be reconnected',
        requiresRestart: false,
        requiresReconnect: true,
        error: 'insufficient_scope',
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Restore failed: ${message}`)
    return {
      success: false,
      message: 'Failed to restore backup',
      requiresRestart: false,
      error: message,
    }
  } finally {
    await unlink(tempPath).catch(() => {})
  }
}
