import { getCloudIdentity, saveCloudIdentity } from './cloudIdentityStore'
import { getInstallation } from './getInstallation'
import { getSyncServiceUrl } from './getSyncServiceUrl'
import { serviceError, syncServiceRequest } from './syncServiceRequest'
import { getRawDatabase } from '../../../db'
import { BUMP_PENDING_SEQ, PENDING_SEQ } from '../pendingSeqSql'
import { runSyncCycle } from '../runSyncCycle'
import { upsertSyncConfig } from '../syncConfigStore'
import { SYNCED_TABLES, syncedRowsSql } from '../syncedTables'

interface Registration {
  churchId: string
  pathSecret: string
  readUrl: string
  deviceId: string
  serverToken: string
  ownerEmail: string | null
}

/**
 * Registers this server on the sync service, owned by the Google account
 * of `ownerTicket` (T-172) or as a guest church, keeps its identity, queues
 * the whole library for the first upload and makes cloud the sync
 * transport. Drive stays available as the backup option (D4).
 */
export async function connectCloudSync(
  serviceUrl: string = getSyncServiceUrl(),
  ownerTicket?: string,
): Promise<{ churchId: string; readUrl: string; ownerEmail: string | null }> {
  if (await getCloudIdentity()) throw new Error('already_connected')

  const response = await syncServiceRequest<Registration>(
    { serviceUrl },
    'POST',
    '/churches',
    { name: getInstallation()?.name, ...(ownerTicket && { ownerTicket }) },
  )
  if (response.status !== 201) throw serviceError(response)
  const { churchId, readUrl, deviceId, serverToken, ownerEmail } = response.body

  await saveCloudIdentity({
    serviceUrl,
    churchId,
    readUrl,
    deviceId,
    serverToken,
    ownerEmail: ownerEmail ?? null,
  })
  queueWholeLibrary()
  await upsertSyncConfig({
    transport: 'cloud',
    syncEnabled: true,
    lastError: null,
  })
  void runSyncCycle()
  return { churchId, readUrl, ownerEmail: ownerEmail ?? null }
}

/** Every synced row, queued for a new church's first upload. */
function queueWholeLibrary(): void {
  const db = getRawDatabase()
  db.run(BUMP_PENDING_SEQ)
  for (const synced of SYNCED_TABLES) {
    db.query(
      `INSERT OR IGNORE INTO sync_pending (entity_type, entity_uuid, queued_at, seq)
       SELECT ?, uuid, unixepoch(), ${PENDING_SEQ}
         FROM (${syncedRowsSql(synced)})`,
    ).run(synced.entityType)
  }
}
