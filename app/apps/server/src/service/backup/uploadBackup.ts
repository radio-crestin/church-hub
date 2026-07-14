import { createReadStream } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

import {
  APP_DATA_FOLDER,
  BACKUP_MIME_TYPE,
  buildBackupFileName,
} from './constants'
import { getDriveService, isInsufficientScopeError } from './getDriveService'
import { getStorageInfo } from './getStorageInfo'
import type { BackupFile } from './listBackups'
import { pruneOldBackups } from './pruneOldBackups'
import { createLogger } from '../../utils/logger'
import { getDataDir } from '../../utils/paths'
import { checkpointAndExport } from '../database'

const logger = createLogger('backup')

export interface BackupUploadResult {
  success: boolean
  fileId?: string
  fileName?: string
  /** Metadata of the created backup, for optimistic list insertion. */
  backup?: BackupFile
  /** True when the connected account lacks the drive.appdata scope. */
  requiresReconnect?: boolean
  error?: string
}

/**
 * Creates a fresh, WAL-checkpointed copy of the database and uploads it to the
 * user's private Google Drive app-data folder, then prunes old backups.
 *
 * Reuses `checkpointAndExport` (the same WAL-safe copy used by the local export
 * feature) so backups are always consistent. Streams the file to Drive to avoid
 * loading the whole database into memory.
 */
export async function uploadBackup(): Promise<BackupUploadResult> {
  const drive = await getDriveService()
  if (!drive) {
    return { success: false, error: 'not_connected' }
  }

  const appVersion = process.env.APP_VERSION || 'dev'
  const fileName = buildBackupFileName(appVersion)
  const tempPath = join(getDataDir(), `.backup-upload-${Date.now()}.db`)

  try {
    const exportResult = await checkpointAndExport(tempPath)
    if (!exportResult.success) {
      return { success: false, error: exportResult.error || 'export_failed' }
    }

    const createdAtMs = Date.now()
    const sizeBytes = await stat(tempPath)
      .then((s) => s.size)
      .catch(() => 0)

    // Preflight: refuse to start an upload Drive has no room for, so the user
    // gets a clear error instead of a failed/partial upload.
    const storage = await getStorageInfo(drive)
    if (
      storage?.availableBytes != null &&
      sizeBytes > 0 &&
      storage.availableBytes < sizeBytes
    ) {
      logger.warning(
        `Backup skipped: Drive has ${storage.availableBytes} bytes free, backup needs ${sizeBytes}`,
      )
      return { success: false, error: 'insufficient_drive_space' }
    }

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [APP_DATA_FOLDER],
        appProperties: {
          appVersion,
          createdAtMs: String(createdAtMs),
        },
      },
      media: {
        mimeType: BACKUP_MIME_TYPE,
        body: createReadStream(tempPath),
      },
      fields: 'id, name',
    })

    logger.info(
      `Backup uploaded to Drive appDataFolder: ${res.data.name} (${res.data.id})`,
    )

    // Retention: keep only the most recent backups.
    await pruneOldBackups(drive)

    const fileId = res.data.id ?? undefined
    return {
      success: true,
      fileId,
      fileName: res.data.name ?? fileName,
      backup: fileId
        ? {
            id: fileId,
            name: res.data.name ?? fileName,
            sizeBytes,
            createdAtMs,
            appVersion,
          }
        : undefined,
    }
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      return {
        success: false,
        requiresReconnect: true,
        error: 'insufficient_scope',
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Backup upload failed: ${message}`)
    return { success: false, error: message }
  } finally {
    await unlink(tempPath).catch(() => {})
  }
}
