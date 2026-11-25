import { hostname } from 'node:os'

import { getCloudIdentity, saveCloudIdentity } from './cloudIdentityStore'
import { getSyncServiceUrl } from './getSyncServiceUrl'
import { serviceError, syncServiceRequest } from './syncServiceRequest'
import { getRawDatabase } from '../../../db'
import { upsertSyncConfig } from '../syncConfigStore'

interface Registration {
  churchId: string
  pathSecret: string
  readUrl: string
  deviceId: string
  serverToken: string
}

/** Every synced root table, queued whole for a new church's first upload. */
const ROOT_TABLES = [
  ['song_category', 'song_categories'],
  ['song_group', 'song_groups'],
  ['song', 'songs'],
  ['schedule', 'schedules'],
] as const

/**
 * Registers this server on the sync service as a guest church (T-172 adds
 * Google sign-in), keeps its identity, queues the whole library for the
 * first upload and makes cloud the sync transport. Drive stays available
 * as the backup option (D4).
 */
export async function connectCloudSync(
  serviceUrl: string = getSyncServiceUrl(),
): Promise<{ churchId: string; readUrl: string }> {
  if (await getCloudIdentity()) throw new Error('already_connected')

  const response = await syncServiceRequest<Registration>(
    { serviceUrl },
    'POST',
    '/churches',
    { name: hostname() },
  )
  if (response.status !== 201) throw serviceError(response)
  const { churchId, readUrl, deviceId, serverToken } = response.body

  await saveCloudIdentity({
    serviceUrl,
    churchId,
    readUrl,
    deviceId,
    serverToken,
  })
  const db = getRawDatabase()
  for (const [entityType, table] of ROOT_TABLES) {
    // Dated a second back, so the first cycle clears them once it has
    // published them (it clears what was queued before its first second).
    db.query(
      `INSERT OR IGNORE INTO sync_pending (entity_type, entity_uuid, queued_at)
       SELECT ?, uuid, unixepoch() - 1 FROM ${table} WHERE uuid != ''`,
    ).run(entityType)
  }
  await upsertSyncConfig({
    transport: 'cloud',
    syncEnabled: true,
    lastError: null,
  })
  return { churchId, readUrl }
}
