import { getSyncConfig } from './syncConfigStore'
import { getRawDatabase } from '../../db'
import { getDriveAuth } from '../backup/driveAuthStore'

export interface SyncStatus {
  enabled: boolean
  /** True when a Google Drive account is connected (shared with backups). */
  connected: boolean
  accountEmail: string | null
  pollIntervalMinutes: number
  lastSyncAt: number | null
  lastError: string | null
  /** Local changes not yet uploaded to Drive. */
  pendingCount: number
  /** Changes applied from other devices the user has not reviewed yet. */
  unseenUpdatesCount: number
}

/** Aggregated sync state for the settings UI and the sync indicator. */
export async function getSyncStatus(): Promise<SyncStatus> {
  const config = await getSyncConfig()
  const auth = await getDriveAuth()
  const db = getRawDatabase()

  const pending = db
    .query<{ count: number }, []>('SELECT COUNT(*) AS count FROM sync_pending')
    .get()
  const unseen = db
    .query<{ count: number }, []>(
      'SELECT COUNT(*) AS count FROM sync_updates WHERE seen = 0',
    )
    .get()

  return {
    enabled: config.syncEnabled,
    connected: auth !== null,
    accountEmail: auth?.email ?? null,
    pollIntervalMinutes: config.pollIntervalMinutes,
    lastSyncAt: config.lastSyncAt,
    lastError: config.lastError,
    pendingCount: pending?.count ?? 0,
    unseenUpdatesCount: unseen?.count ?? 0,
  }
}
