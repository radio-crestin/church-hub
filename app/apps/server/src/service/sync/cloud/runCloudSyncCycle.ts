import { buildPushChanges } from './buildPushChanges'
import {
  type CloudIdentity,
  getCloudIdentity,
  updateCloudIdentity,
} from './cloudIdentityStore'
import { fetchRemoteChanges } from './fetchRemoteChanges'
import { pushAccessIfChanged } from './pushAccessIfChanged'
import { pushChanges } from './pushChanges'
import { refreshReadUrl } from './refreshReadUrl'
import { getServerConflict } from './serverConflict'
import { getSyncVersions, setSyncVersions } from './syncVersionsStore'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'
import { toErrorMessage } from '../../../utils/toErrorMessage'
import { broadcastSyncApplied } from '../../../websocket'
import { adoptRemoteIdentities } from '../adoptRemoteIdentities'
import { applyRemoteChanges } from '../applyRemoteChanges'
import { TOMBSTONE_RETENTION_DAYS } from '../constants'
import { getPendingKeys } from '../getPendingKeys'
import { mergeLibraries } from '../mergeLibraries'
import { serializeLibrary } from '../serializeLibrary'
import { upsertSyncConfig } from '../syncConfigStore'
import { getSyncState } from '../syncStateStore'
import type { SyncCycleResult } from '../types'

const logger = createLogger('sync')

/** A write refused as a conflict is pulled, merged and sent again this often. */
const MAX_CONFLICT_ROUNDS = 3
/** The PC checks in with the service at least this often (reads skip it). */
const CHECK_IN_EVERY_MS = 15 * 60 * 1000

let isRunning = false
let lastCheckInAt = 0

interface RoundResult {
  outcome: 'done' | 'conflict' | 'unchanged'
  applied: number
  pushed: boolean
  reported: number
}

/** One pull → merge → apply → push round against the church's bucket. */
async function syncRound(identity: CloudIdentity): Promise<RoundResult> {
  const cycleStartSeconds = Math.floor(Date.now() / 1000)
  await pushAccessIfChanged(identity)

  const remote = await fetchRemoteChanges(identity)
  // A server joining a church that already has a library matches its own
  // rows to the church's first, so nothing is duplicated.
  if (remote?.fromSnapshot && identity.seq === 0) {
    adoptRemoteIdentities(remote.library)
  }
  const dirtyKeys = getPendingKeys()
  const hasTombstonesToPush = getRawDatabase()
    .query<{ n: number }, []>(
      `SELECT COUNT(*) AS n FROM sync_tombstones t
        WHERE NOT EXISTS (SELECT 1 FROM sync_versions v
          WHERE v.entity_type = t.entity_type
            AND v.entity_uuid = t.entity_uuid AND v.deleted = 1)`,
    )
    .get()?.n
  if (!remote && dirtyKeys.size === 0 && !hasTombstonesToPush) {
    return { outcome: 'unchanged', applied: 0, pushed: false, reported: 0 }
  }

  const state = getSyncState()
  const local = serializeLibrary(state.deviceId, state.deviceName, dirtyKeys)
  const { merged, applyOps } = mergeLibraries(
    local,
    remote?.library ?? null,
    dirtyKeys,
    cycleStartSeconds,
  )
  const { appliedCount, reportedCount } = applyRemoteChanges(applyOps)
  if (remote) {
    setSyncVersions(remote.versions)
    await updateCloudIdentity({ seq: remote.seq, headEtag: remote.headEtag })
    identity.seq = remote.seq
    identity.headEtag = remote.headEtag
  }

  const changes = buildPushChanges(
    merged,
    local,
    dirtyKeys,
    applyOps,
    getSyncVersions(),
  )
  if (changes.length > 0) {
    const outcome = await pushChanges(identity, changes)
    if (outcome === 'conflict') {
      return {
        outcome,
        applied: appliedCount,
        pushed: false,
        reported: reportedCount,
      }
    }
    logger.info(`Published ${changes.length} change(s) to cloud sync`)
  }

  // Only what was queued before this cycle's first second: queued_at is in
  // seconds, so an edit made later in that second, after the pending rows
  // were read, stays queued for the next cycle instead of being lost.
  const db = getRawDatabase()
  db.query('DELETE FROM sync_pending WHERE queued_at < ?').run(
    cycleStartSeconds,
  )
  db.query('DELETE FROM sync_tombstones WHERE deleted_at < ?').run(
    cycleStartSeconds - TOMBSTONE_RETENTION_DAYS * 24 * 3600,
  )
  return {
    outcome: 'done',
    applied: appliedCount,
    pushed: changes.length > 0,
    reported: reportedCount,
  }
}

/**
 * The cloud transport's sync cycle (T-171): reads what changed from the
 * church's bucket, merges it with the local library (last writer wins, the
 * Drive transport's merge), applies it, and publishes the local edits that
 * won through the sync service. A write the service refuses as a conflict is
 * pulled and merged again. Failures are kept on sync_config.lastError.
 */
export async function runCloudSyncCycle(): Promise<SyncCycleResult> {
  if (isRunning) return { success: true, skipped: 'no_changes' }
  const identity = await getCloudIdentity()
  if (!identity) {
    await upsertSyncConfig({ lastError: 'not_connected' })
    return { success: false, skipped: 'not_connected', error: 'not_connected' }
  }

  if (getServerConflict()) {
    await upsertSyncConfig({ lastError: 'server_in_use' })
    return { success: false, error: 'server_in_use' }
  }

  isRunning = true
  try {
    // Reads go to the bucket alone; checking in finds another PC holding
    // this church's token, a new read path and a new owner.
    if (Date.now() - lastCheckInAt > CHECK_IN_EVERY_MS) {
      await refreshReadUrl(identity)
      lastCheckInAt = Date.now()
    }
    let applied = 0
    let reported = 0
    for (let round = 0; round < MAX_CONFLICT_ROUNDS; round++) {
      const result = await syncRound(identity)
      applied += result.applied
      reported += result.reported
      if (result.outcome === 'conflict') continue

      await upsertSyncConfig({ lastSyncAt: Date.now(), lastError: null })
      if (reported > 0) broadcastSyncApplied(reported)
      if (result.outcome === 'unchanged' && applied === 0) {
        return { success: true, skipped: 'no_changes' }
      }
      return { success: true, applied, pushed: result.pushed }
    }
    throw new Error('conflict: rows keep changing elsewhere, retrying later')
  } catch (error) {
    const message = toErrorMessage(error)
    logger.error(`Cloud sync cycle failed: ${message}`)
    await upsertSyncConfig({ lastError: message })
    return { success: false, error: message }
  } finally {
    isRunning = false
  }
}
