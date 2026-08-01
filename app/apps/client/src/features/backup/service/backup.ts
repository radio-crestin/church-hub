import { fetcher } from '~/utils/fetcher'

export interface BackupStorageInfo {
  /** Total Drive quota in bytes; null when the account has unlimited storage. */
  limitBytes: number | null
  /** Bytes currently used across the whole Drive account. */
  usageBytes: number
  /** Free Drive space in bytes; null when the account has unlimited storage. */
  availableBytes: number | null
  /** Current database size — the approximate size of the next backup. */
  dbSizeBytes: number
  /** True when the free Drive space cannot fit another backup. */
  insufficientSpace: boolean
}

export interface BackupStatus {
  /** Always true — OAuth goes through the ChurchHub worker (kept for API compat). */
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
  /** Number of most-recent backups kept in Drive; older ones are pruned. */
  maxBackups: number
  lastBackupAt: number | null
  /** Folder local backups are written to; null when local backups are off. */
  localBackupPath: string | null
  lastLocalBackupAt: number | null
  /** Drive storage quota vs. database size; null when Drive is unreachable. */
  storage: BackupStorageInfo | null
}

export interface BackupConfig {
  autoBackupEnabled: boolean
  intervalHours: number
  maxBackups: number
  lastBackupAt: number | null
  localBackupPath: string | null
  lastLocalBackupAt: number | null
}

/** A backup file sitting in the operator's configured local folder. */
export interface LocalBackupFile {
  /** File name, which also identifies it (the folder comes from config). */
  name: string
  /** Absolute path, shown so the file can be found outside the app. */
  path: string
  sizeBytes: number
  createdAtMs: number
  appVersion: string | null
}

export interface BackupCounts {
  songs: number
  songSlides: number
  songCategories: number
  songBookmarks: number
  schedules: number
  scheduleItems: number
  musicPlaylists: number
  musicFiles: number
  bibleTranslations: number
  users: number
  screens: number
}

export interface BackupSchedule {
  title: string
  createdAtMs: number | null
  /** Total items in the program (songs, passages, slides, scenes). */
  itemCount: number
  /** Song items only. */
  songCount: number
  /** First few song titles, in program order. */
  songTitles: string[]
}

export interface BackupContents {
  counts: BackupCounts
  songs: { title: string; category: string | null }[]
  schedules: BackupSchedule[]
  playlists: { name: string; itemCount: number }[]
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
 * Starts the Google Drive connect flow and returns the authorization URL (on
 * the ChurchHub OAuth worker) to open in a browser, or copy into a private
 * window.
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

/** Backups upload the whole database to Drive, which can take minutes. */
const LARGE_OP_TIMEOUT_MS = 10 * 60 * 1000

export async function backupNow(): Promise<BackupActionResult> {
  const res = await fetcher<
    ApiResponse<{ fileId: string; fileName: string; backup?: BackupFile }>
  >('/api/backup/now', { method: 'POST', timeout: LARGE_OP_TIMEOUT_MS })
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
    timeout: LARGE_OP_TIMEOUT_MS,
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

/**
 * Reads a backup's contents (song titles, schedules, playlists and per-table
 * counts) without restoring it. The server downloads the whole backup first,
 * so this shares the large-operation timeout.
 */
export async function inspectBackup(fileId: string): Promise<BackupContents> {
  const res = await fetcher<ApiResponse<BackupContents>>(
    '/api/backup/inspect',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
      timeout: LARGE_OP_TIMEOUT_MS,
    },
  )
  if (!res.data) {
    const err = new Error(res.error || 'Failed to inspect backup') as Error & {
      requiresReconnect?: boolean
    }
    err.requiresReconnect = res.requiresReconnect
    throw err
  }
  return res.data
}

export async function updateBackupConfig(
  patch: Partial<
    Pick<
      BackupConfig,
      'autoBackupEnabled' | 'intervalHours' | 'maxBackups' | 'localBackupPath'
    >
  >,
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

/** Lists the backups in the configured local folder, newest first. */
/**
 * Backups in the configured folder, or in `dir` when the operator is browsing
 * somewhere else to restore from — passing a folder here never changes where
 * future backups are written.
 */
export async function listLocalBackups(
  dir?: string | null,
): Promise<LocalBackupFile[]> {
  const query = dir ? `?dir=${encodeURIComponent(dir)}` : ''
  const res = await fetcher<ApiResponse<{ backups: LocalBackupFile[] }>>(
    `/api/backup/local/list${query}`,
    { cache: 'no-store' },
  )
  if (res.error) {
    throw new Error(res.error)
  }
  return res.data?.backups ?? []
}

/**
 * Replaces the database with a local backup — either one in the configured
 * folder (`fileName`) or one anywhere on disk (`path`).
 *
 * Given the same ten-minute budget as the Drive restore: the work is a
 * checkpoint plus a file copy, which on a large library outlasts the default
 * request timeout even though nothing is downloaded.
 */
export async function restoreLocalBackup(input: {
  fileName?: string
  path?: string
}): Promise<BackupActionResult> {
  const res = await fetcher<
    ApiResponse<{ success: boolean; message: string; requiresRestart: boolean }>
  >('/api/backup/local/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    timeout: LARGE_OP_TIMEOUT_MS,
  })
  if (res.error) {
    return { success: false, error: res.error }
  }
  return {
    success: true,
    requiresRestart: res.data?.requiresRestart,
    message: res.data?.message,
  }
}

/** Writes a fresh backup into the configured local folder. */
export async function localBackupNow(): Promise<
  BackupActionResult & { path?: string }
> {
  const res = await fetcher<ApiResponse<{ success: boolean; path?: string }>>(
    '/api/backup/local/now',
    { method: 'POST' },
  )
  if (res.error) {
    return { success: false, error: res.error }
  }
  return { success: true, path: res.data?.path }
}

/** Deletes one backup file from the configured local folder. */
export async function deleteLocalBackup(
  fileName: string,
): Promise<BackupActionResult> {
  const res = await fetcher<ApiResponse<{ success: boolean }>>(
    '/api/backup/local/delete',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    },
  )
  if (res.error) {
    return { success: false, error: res.error }
  }
  return { success: true }
}
