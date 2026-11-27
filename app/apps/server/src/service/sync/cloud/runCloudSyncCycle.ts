import { buildPushChanges } from './buildPushChanges'
import {
  type CloudIdentity,
  getCloudIdentity,
  updateCloudIdentity,
} from './cloudIdentityStore'
import { fetchRemoteChanges } from './fetchRemoteChanges'
import { keysToMerge } from './keysToMerge'
import { pushChanges } from './pushChanges'
import { refreshReadUrl } from './refreshReadUrl'
import { rollBackRejected } from './rollBackRejected'
import { getServerConflict } from './serverConflict'
import { getSyncVersions, setSyncVersions } from './syncVersionsStore'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'
import { toErrorMessage } from '../../../utils/toErrorMessage'
import { broadcastSyncApplied } from '../../../websocket'
import { adoptRemoteIdentities } from '../adoptRemoteIdentities'
import { applyRemoteChanges } from '../applyRemoteChanges'
import { TOMBSTONE_RETENTION_DAYS } from '../constants'
import { getChangeAuthors } from '../getChangeAuthors'
import { getLatestPendingSeq } from '../getLatestPendingSeq'
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

let running: Promise<SyncCycleResult> | null = null
let lastCheckInAt = 0
let followUp: (() => Promise<void>) | null = null

/**
 * Work that follows each successful cycle on this device, outside the
 * cycle's turn (the PC publishing the media its data shows: cloud-media).
 */
export function setCloudSyncFollowUp(work: () => Promise<void>): void {
  followUp = work
}

interface RoundResult {
  outcome: 'done' | 'conflict' | 'unchanged'
  applied: number
  pushed: boolean
  reported: number
}

/** One pull → merge → apply → push round against the church's bucket. */
async function syncRound(identity: CloudIdentity): Promise<RoundResult> {
  const cycleStartSeconds = Math.floor(Date.now() / 1000)

  const remote = await fetchRemoteChanges(identity)
  // A server joining a church that already has a library matches its own
  // rows to the church's first, so nothing is duplicated.
  if (remote?.fromSnapshot && identity.seq === 0) {
    adoptRemoteIdentities(remote.library)
  }
  const sentUpTo = getLatestPendingSeq()
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
  // A snapshot (a first join) is the whole church: everything is merged.
  const keys = remote?.fromSnapshot
    ? undefined
    : keysToMerge(dirtyKeys, remote?.library ?? null)
  const local = serializeLibrary(
    state.deviceId,
    state.deviceName,
    dirtyKeys,
    keys,
  )
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
    getSyncVersions(keys),
    getChangeAuthors(),
  )
  if (changes.length > 0) {
    const pushed = await pushChanges(identity, changes)
    if (pushed.outcome !== 'pushed') {
      // Refused changes go back as the church has them; the next round
      // sends the rest.
      const rolledBack =
        pushed.outcome === 'rejected'
          ? await rollBackRejected(identity, pushed.rejected, local)
          : 0
      return {
        outcome: 'conflict',
        applied: appliedCount,
        pushed: false,
        reported: reportedCount + rolledBack,
      }
    }
    logger.info(`Published ${changes.length} change(s) to cloud sync`)
  }

  // Only what this round read and sent: an edit queued after, even in the
  // same second, stays queued for the next round instead of being lost. A
  // change left queued once sent goes out again, and would undo a newer
  // one made elsewhere in the same second (a phone revoking a permission).
  const db = getRawDatabase()
  db.query('DELETE FROM sync_pending WHERE seq <= ?').run(sentUpTo)
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
 * pulled and merged again; one it refuses as not allowed is put back as the
 * church has it. Failures are kept on sync_config.lastError.
 *
 * One cycle at a time: a call while one runs is skipped, unless it
 * `waitsItsTurn` (a change that must go out now, like a user's sign-out):
 * then it waits for that cycle and runs its own, so what was queued before
 * the call is sent when it returns.
 */
export async function runCloudSyncCycle({
  waitsItsTurn = false,
} = {}): Promise<SyncCycleResult> {
  if (running && !waitsItsTurn) return { success: true, skipped: 'no_changes' }
  while (running) await running
  running = cloudSyncCycle()
    .then((result) => {
      if (result.success) void followUp?.()
      return result
    })
    .finally(() => {
      running = null
    })
  return running
}

async function cloudSyncCycle(): Promise<SyncCycleResult> {
  const identity = await getCloudIdentity()
  if (!identity) {
    await upsertSyncConfig({ lastError: 'not_connected' })
    return { success: false, skipped: 'not_connected', error: 'not_connected' }
  }

  if (getServerConflict()) {
    await upsertSyncConfig({ lastError: 'server_in_use' })
    return { success: false, error: 'server_in_use' }
  }

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
  }
}
