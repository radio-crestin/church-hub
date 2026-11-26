import type { ChurchConnection } from './protocol'
import { getRawDatabase } from '../../../../../server/src/db'
import { saveCloudIdentity } from '../../../../../server/src/service/sync/cloud/cloudIdentityStore'
import { runCloudSyncCycle } from '../../../../../server/src/service/sync/cloud/runCloudSyncCycle'
import { upsertSyncConfig } from '../../../../../server/src/service/sync/syncConfigStore'
import {
  SYNCED_TABLES,
  syncedRowsSql,
} from '../../../../../server/src/service/sync/syncedTables'
import { withTriggersSuppressed } from '../../../../../server/src/service/sync/syncStateStore'

/**
 * A joined browser mirrors its church: the rows a new database seeds for
 * itself (the first admin, the default categories and settings) are no
 * one's edits, so they go before the first sync, unsent.
 */
function dropSeededLibrary(): void {
  const db = getRawDatabase()
  withTriggersSuppressed(() => {
    for (const synced of [...SYNCED_TABLES].reverse()) {
      db.run(
        `DELETE FROM ${synced.table} WHERE ${synced.uuidColumn} IN (${syncedRowsSql(synced)})`,
      )
    }
  })
  db.run('DELETE FROM sync_pending')
  db.run('DELETE FROM sync_tombstones')
}

/**
 * Turns a new database into the church's: its identity on the sync service
 * (this browser's device token), cloud sync on, and a first sync that reads
 * the church's snapshot and segments straight from its bucket.
 */
export async function joinChurchDatabase(
  church: ChurchConnection,
): Promise<void> {
  dropSeededLibrary()
  await saveCloudIdentity({
    serviceUrl: church.serviceUrl,
    churchId: church.churchId,
    readUrl: church.readUrl,
    deviceId: church.deviceId,
    serverToken: church.token,
    ownerEmail: null,
  })
  await upsertSyncConfig({ syncEnabled: true, transport: 'cloud' })
  const result = await runCloudSyncCycle()
  if (!result.success) {
    throw new Error(`First sync failed: ${result.error ?? 'unknown error'}`)
  }
}
