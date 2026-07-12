import { getBackupConfig } from './backupConfig'
import { APP_DATA_FOLDER } from './constants'
import { getDriveAuth } from './driveAuthStore'
import { getDriveService, isInsufficientScopeError } from './getDriveService'
import { getDriveOAuthConfig } from './oauth/config'

export interface BackupStatus {
  /** The Drive OAuth client credentials are configured on this build. */
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
  lastBackupAt: number | null
}

/**
 * Reports whether Drive backup is configured/connected/usable and returns the
 * connected account email plus the auto-backup settings.
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const config = await getBackupConfig()
  const { configured } = getDriveOAuthConfig()

  if (!configured) {
    return {
      configured: false,
      connected: false,
      driveReady: false,
      requiresReconnect: false,
      email: null,
      ...config,
    }
  }

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
      }
    }
    return {
      configured: true,
      connected: true,
      driveReady: false,
      requiresReconnect: false,
      email,
      ...config,
    }
  }
}
