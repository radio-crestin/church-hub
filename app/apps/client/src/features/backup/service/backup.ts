import { fetcher } from '~/utils/fetcher'

export interface BackupStatus {
  /** A Google account is connected (shared with the livestream feature). */
  connected: boolean
  /** The connected account has Drive access and backups are usable. */
  driveReady: boolean
  /** Connected but missing the Drive scope — reconnect to re-consent. */
  requiresReconnect: boolean
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
  const res = await fetcher<ApiResponse<{ fileId: string; fileName: string }>>(
    '/api/backup/now',
    { method: 'POST' },
  )
  if (res.error) {
    return {
      success: false,
      error: res.error,
      requiresReconnect: res.requiresReconnect,
    }
  }
  return { success: true, fileName: res.data?.fileName }
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
