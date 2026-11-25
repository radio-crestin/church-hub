import { getCloudIdentity } from './cloud/cloudIdentityStore'
import { getSyncConfig, type SyncTransport } from './syncConfigStore'
import { getRawDatabase } from '../../db'
import { getDriveAuth } from '../backup/driveAuthStore'

export interface SyncStatus {
  enabled: boolean
  /** The cloud sync service, or Google Drive as the backup option. */
  transport: SyncTransport
  /**
   * True when the transport can sync: a church on the sync service (cloud),
   * or a connected Google Drive account (shared with backups).
   */
  connected: boolean
  /** This server's church on the sync service, when connected. */
  cloud: { churchId: string; serviceUrl: string; seq: number } | null
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
  const identity = await getCloudIdentity()
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
    transport: config.transport,
    connected: config.transport === 'cloud' ? identity !== null : auth !== null,
    cloud: identity
      ? {
          churchId: identity.churchId,
          serviceUrl: identity.serviceUrl,
          seq: identity.seq,
        }
      : null,
    accountEmail: auth?.email ?? null,
    pollIntervalMinutes: config.pollIntervalMinutes,
    lastSyncAt: config.lastSyncAt,
    lastError: config.lastError,
    pendingCount: pending?.count ?? 0,
    unseenUpdatesCount: unseen?.count ?? 0,
  }
}
