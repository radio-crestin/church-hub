import { fetcher } from '~/utils/fetcher'

export type SyncEntityType =
  | 'song'
  | 'song_category'
  | 'song_group'
  | 'schedule'

export type SyncChangeKind = 'added' | 'updated' | 'removed' | 'conflict'

export interface SyncStatus {
  enabled: boolean
  /** A Google account (the backup connection) is available for sync. */
  connected: boolean
  accountEmail: string | null
  pollIntervalMinutes: number
  /** Unix ms of the last completed sync cycle. */
  lastSyncAt: number | null
  lastError: string | null
  /** Local changes not yet pushed to Drive. */
  pendingCount: number
  /** Remote changes applied locally and not yet reviewed. */
  unseenUpdatesCount: number
}

export interface SyncConfig {
  syncEnabled: boolean
  pollIntervalMinutes: number
  lastSyncAt: number | null
  lastError: string | null
}

export interface SyncNowResult {
  success: boolean
  skipped?: 'disabled' | 'not_connected' | 'no_changes'
  /** Number of remote changes applied locally. */
  applied?: number
  /** Whether local changes were pushed to Drive. */
  pushed?: boolean
  error?: string
}

export interface SyncUpdate {
  id: number
  entityType: SyncEntityType
  entityUuid: string
  localId: number | null
  changeKind: SyncChangeKind
  title: string
  /** Unix SECONDS (not ms). */
  occurredAt: number
  seen: boolean
  /** Human-readable device name (hostname) the change was made on. */
  sourceDevice: string | null
}

export interface SyncPendingEntry {
  entityType: SyncEntityType
  entityUuid: string
  localId: number | null
  title: string
  /** Unix SECONDS (not ms). */
  queuedAt: number
}

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const res = await fetcher<ApiResponse<SyncStatus>>('/api/sync/status')
  if (!res.data) {
    throw new Error(res.error || 'Failed to load sync status')
  }
  return res.data
}

export async function getSyncConfig(): Promise<SyncConfig> {
  const res = await fetcher<ApiResponse<SyncConfig>>('/api/sync/config')
  if (!res.data) {
    throw new Error(res.error || 'Failed to load sync settings')
  }
  return res.data
}

export async function updateSyncConfig(
  patch: Partial<Pick<SyncConfig, 'syncEnabled' | 'pollIntervalMinutes'>>,
): Promise<SyncConfig> {
  const res = await fetcher<ApiResponse<SyncConfig>>('/api/sync/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.data) {
    throw new Error(res.error || 'Failed to update sync settings')
  }
  return res.data
}

/** A full sync cycle downloads/uploads library data, which can take a while. */
const SYNC_NOW_TIMEOUT_MS = 5 * 60 * 1000

export async function syncNow(): Promise<SyncNowResult> {
  const res = await fetcher<ApiResponse<SyncNowResult>>('/api/sync/now', {
    method: 'POST',
    timeout: SYNC_NOW_TIMEOUT_MS,
  })
  if (!res.data) {
    return { success: false, error: res.error }
  }
  return res.data
}

export async function getSyncUpdates(unseenOnly = true): Promise<SyncUpdate[]> {
  const res = await fetcher<ApiResponse<{ updates: SyncUpdate[] }>>(
    `/api/sync/updates${unseenOnly ? '?unseenOnly=true' : ''}`,
  )
  if (!res.data) {
    throw new Error(res.error || 'Failed to load sync updates')
  }
  return res.data.updates
}

/** Local changes queued for upload to Drive (deletions are not listed). */
export async function getSyncPending(): Promise<SyncPendingEntry[]> {
  const res =
    await fetcher<ApiResponse<{ pending: SyncPendingEntry[] }>>(
      '/api/sync/pending',
    )
  if (!res.data) {
    throw new Error(res.error || 'Failed to load pending sync changes')
  }
  return res.data.pending
}

/** Marks the given update entries seen; with no ids, marks all of them. */
export async function markSyncUpdatesSeen(
  ids?: number[],
): Promise<{ markedSeen: number }> {
  const res = await fetcher<ApiResponse<{ markedSeen: number }>>(
    '/api/sync/updates/seen',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    },
  )
  if (!res.data) {
    throw new Error(res.error || 'Failed to mark sync updates seen')
  }
  return res.data
}
