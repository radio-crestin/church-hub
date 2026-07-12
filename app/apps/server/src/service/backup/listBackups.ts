import { APP_DATA_FOLDER, isBackupFile } from './constants'
import { getDriveService, isInsufficientScopeError } from './getDriveService'
import { createLogger } from '../../utils/logger'

const logger = createLogger('backup')

export interface BackupFile {
  id: string
  name: string
  sizeBytes: number
  createdAtMs: number
  appVersion?: string
}

export interface ListBackupsResult {
  success: boolean
  backups?: BackupFile[]
  requiresReconnect?: boolean
  error?: string
}

/**
 * Lists the app's backups stored in the user's Google Drive app-data folder,
 * newest first.
 */
export async function listBackups(): Promise<ListBackupsResult> {
  const drive = await getDriveService()
  if (!drive) {
    return { success: false, error: 'not_connected' }
  }

  try {
    const res = await drive.files.list({
      spaces: APP_DATA_FOLDER,
      orderBy: 'createdTime desc',
      pageSize: 100,
      fields: 'files(id, name, size, createdTime, appProperties)',
    })

    const backups: BackupFile[] = (res.data.files ?? [])
      .filter((f) => isBackupFile(f.name))
      .map((f) => ({
        id: f.id!,
        name: f.name!,
        sizeBytes: Number(f.size ?? 0),
        createdAtMs: f.appProperties?.createdAtMs
          ? Number(f.appProperties.createdAtMs)
          : f.createdTime
            ? Date.parse(f.createdTime)
            : 0,
        appVersion: f.appProperties?.appVersion ?? undefined,
      }))

    return { success: true, backups }
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      return {
        success: false,
        requiresReconnect: true,
        error: 'insufficient_scope',
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Listing backups failed: ${message}`)
    return { success: false, error: message }
  }
}
