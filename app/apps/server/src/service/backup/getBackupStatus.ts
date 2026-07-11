import { getBackupConfig } from './backupConfig'
import { APP_DATA_FOLDER } from './constants'
import { getDriveService, isInsufficientScopeError } from './getDriveService'

export interface BackupStatus {
  /** A Google account is connected (livestream/backup share one connection). */
  connected: boolean
  /** The connected account has the drive.appdata scope and Drive is reachable. */
  driveReady: boolean
  /** Connected but missing the Drive scope — user must reconnect to re-consent. */
  requiresReconnect: boolean
  autoBackupEnabled: boolean
  intervalHours: number
  lastBackupAt: number | null
}

/**
 * Reports whether Drive backup is usable and returns the auto-backup settings.
 * Performs a minimal Drive probe to distinguish "connected with Drive access"
 * from "connected but the account predates the Drive scope".
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const config = await getBackupConfig()
  const drive = await getDriveService()

  if (!drive) {
    return {
      connected: false,
      driveReady: false,
      requiresReconnect: false,
      ...config,
    }
  }

  try {
    await drive.files.list({
      spaces: APP_DATA_FOLDER,
      pageSize: 1,
      fields: 'files(id)',
    })
    return {
      connected: true,
      driveReady: true,
      requiresReconnect: false,
      ...config,
    }
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      return {
        connected: true,
        driveReady: false,
        requiresReconnect: true,
        ...config,
      }
    }
    // Network/other transient error: connected but could not verify Drive.
    return {
      connected: true,
      driveReady: false,
      requiresReconnect: false,
      ...config,
    }
  }
}
