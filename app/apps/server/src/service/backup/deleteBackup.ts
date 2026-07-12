import { getDriveService, isInsufficientScopeError } from './getDriveService'
import { createLogger } from '../../utils/logger'

const logger = createLogger('backup')

export interface DeleteBackupResult {
  success: boolean
  requiresReconnect?: boolean
  error?: string
}

/**
 * Permanently deletes a single backup from the user's Google Drive app-data
 * folder.
 */
export async function deleteBackup(
  fileId: string,
): Promise<DeleteBackupResult> {
  const drive = await getDriveService()
  if (!drive) {
    return { success: false, error: 'not_connected' }
  }

  try {
    await drive.files.delete({ fileId })
    logger.info(`Deleted backup ${fileId} from Drive`)
    return { success: true }
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      return {
        success: false,
        requiresReconnect: true,
        error: 'insufficient_scope',
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Deleting backup ${fileId} failed: ${message}`)
    return { success: false, error: message }
  }
}
