import { getBackupConfig } from './backupConfig'
import { APP_DATA_FOLDER } from './constants'
import { getDriveAuth } from './driveAuthStore'
import { getDriveService, isInsufficientScopeError } from './getDriveService'
import { type BackupStorageInfo, getStorageInfo } from './getStorageInfo'

export interface BackupStatus {
  /** Drive backup is available on this build. Always true now that OAuth goes
   * through the ChurchHub worker (no local credentials needed); kept for API
   * compatibility. */
  configured: boolean
  /** A Google account is connected for backups. */
  connected: boolean
  /** Connected and Drive is reachable — backups are usable. */
  driveReady: boolean
  /** Connected but Drive access failed on a scope check (reconnect needed). */
  requiresReconnect: boolean
  /** Email of the connected Google account, when known. */
  email: string | null
  autoBackupEnabled: boolean
  intervalHours: number
  maxBackups: number
  lastBackupAt: number | null
  /** Folder local backups are written to; null when local backups are off. */
  localBackupPath: string | null
  lastLocalBackupAt: number | null
  /** Drive storage quota vs. database size; null when Drive is unreachable. */
  storage: BackupStorageInfo | null
}

/**
 * Reports whether Drive backup is configured/connected/usable and returns the
 * connected account email plus the auto-backup settings.
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const config = await getBackupConfig()

  // getDriveService refreshes the token and clears the connection if the refresh
  // token has expired, so a null result here means "not connected".
  const drive = await getDriveService()
  if (!drive) {
    return {
      configured: true,
      connected: false,
      driveReady: false,
      requiresReconnect: false,
      email: null,
      ...config,
      storage: null,
    }
  }

  const record = await getDriveAuth()
  const email = record?.email ?? null

  try {
    await drive.files.list({
      spaces: APP_DATA_FOLDER,
      pageSize: 1,
      fields: 'files(id)',
    })
    return {
      configured: true,
      connected: true,
      driveReady: true,
      requiresReconnect: false,
      email,
      ...config,
      storage: await getStorageInfo(drive),
    }
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      return {
        configured: true,
        connected: true,
        driveReady: false,
        requiresReconnect: true,
        email,
        ...config,
        storage: null,
      }
    }
    return {
      configured: true,
      connected: true,
      driveReady: false,
      requiresReconnect: false,
      email,
      ...config,
      storage: null,
    }
  }
}
