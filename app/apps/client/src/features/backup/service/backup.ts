import { fetcher } from '~/utils/fetcher'

export interface BackupStatus {
  /** The Drive OAuth client is configured on this build. */
  configured: boolean
  /** A Google account is connected for backups. */
  connected: boolean
  /** The connected account has Drive access and backups are usable. */
  driveReady: boolean
  /** Connected but Drive access failed a scope check — reconnect to re-consent. */
  requiresReconnect: boolean
  /** Email of the connected Google account, when known. */
  email: string | null
  autoBackupEnabled: boolean
  intervalHours: number
  lastBackupAt: number | null
}

export interface BackupConfig {
  autoBackupEnabled: boolean
  intervalHours: number
  lastBackupAt: number | null
}

export interface BackupFile {
  id: string
  name: string
  sizeBytes: number
  createdAtMs: number
  appVersion?: string
}

export interface BackupActionResult {
  success: boolean
  error?: string
  requiresReconnect?: boolean
  fileName?: string
  /** Metadata of a just-created backup (for optimistic list insertion). */
  backup?: BackupFile
  requiresRestart?: boolean
  message?: string
}

interface ApiResponse<T> {
  data?: T
  error?: string
  requiresReconnect?: boolean
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const res = await fetcher<ApiResponse<BackupStatus>>('/api/backup/status')
  if (!res.data) {
    throw new Error(res.error || 'Failed to load backup status')
  }
  return res.data
}

/**
 * Starts the Google Drive connect flow and returns the authorization URL to open
 * in a browser (or copy into a private window). `error` is 'not_configured' when
 * the Drive OAuth client isn't set up on this build.
 */
export async function connectGoogleDrive(): Promise<{
  authUrl?: string
  error?: string
}> {
  const res = await fetcher<ApiResponse<{ authUrl: string }>>(
    '/api/backup/google/connect',
  )
  if (res.error) return { error: res.error }
  return { authUrl: res.data?.authUrl }
}

export async function disconnectGoogleDrive(): Promise<void> {
  await fetcher('/api/backup/google/disconnect', { method: 'POST' })
}

export async function listBackups(): Promise<BackupFile[]> {
  const res =
    await fetcher<ApiResponse<{ backups: BackupFile[] }>>('/api/backup/list')
  if (res.error) {
    const err = new Error(res.error) as Error & { requiresReconnect?: boolean }
    err.requiresReconnect = res.requiresReconnect
    throw err
  }
  return res.data?.backups ?? []
}

export async function backupNow(): Promise<BackupActionResult> {
  const res = await fetcher<
    ApiResponse<{ fileId: string; fileName: string; backup?: BackupFile }>
  >('/api/backup/now', { method: 'POST' })
  if (res.error) {
    return {
      success: false,
      error: res.error,
      requiresReconnect: res.requiresReconnect,
    }
  }
  return {
    success: true,
    fileName: res.data?.fileName,
    backup: res.data?.backup,
  }
}

export async function restoreBackup(
  fileId: string,
): Promise<BackupActionResult> {
  const res = await fetcher<
    ApiResponse<{ success: boolean; message: string; requiresRestart: boolean }>
  >('/api/backup/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
  })
  if (res.error) {
    return {
      success: false,
      error: res.error,
      requiresReconnect: res.requiresReconnect,
    }
  }
  return {
    success: true,
    requiresRestart: res.data?.requiresRestart,
    message: res.data?.message,
  }
}

export async function deleteBackup(
  fileId: string,
): Promise<BackupActionResult> {
  const res = await fetcher<ApiResponse<{ success: boolean }>>(
    '/api/backup/delete',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    },
  )
  if (res.error) {
    return {
      success: false,
      error: res.error,
      requiresReconnect: res.requiresReconnect,
    }
  }
  return { success: true }
}

export async function updateBackupConfig(
  patch: Partial<Pick<BackupConfig, 'autoBackupEnabled' | 'intervalHours'>>,
): Promise<BackupConfig> {
  const res = await fetcher<ApiResponse<BackupConfig>>('/api/backup/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.data) {
    throw new Error(res.error || 'Failed to update backup settings')
  }
  return res.data
}
