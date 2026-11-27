import { adoptRemoteIdentities } from './adoptRemoteIdentities'
import { applyRemoteChanges } from './applyRemoteChanges'
import { runCloudSyncCycle } from './cloud/runCloudSyncCycle'
import { TOMBSTONE_RETENTION_DAYS } from './constants'
import {
  downloadLibrary,
  findLibraryFile,
  uploadLibrary,
} from './driveLibraryFile'
import { getLatestPendingSeq } from './getLatestPendingSeq'
import { getPendingKeys } from './getPendingKeys'
import { libraryChanged } from './libraryChanged'
import { mergeLibraries } from './mergeLibraries'
import { serializeLibrary } from './serializeLibrary'
import { getSyncConfig, upsertSyncConfig } from './syncConfigStore'
import { getSyncState, updateRemoteFileRef } from './syncStateStore'
import type { SyncCycleResult } from './types'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'
import { toErrorMessage } from '../../utils/toErrorMessage'
import { broadcastSyncApplied } from '../../websocket'
import { getDriveService } from '../backup/getDriveService'

const logger = createLogger('sync')

let isRunning = false

/**
 * Runs one sync cycle on the configured transport: the cloud sync service
 * (runCloudSyncCycle) or, as the backup option, the shared Drive library file:
 * download → adopt identities → merge (last-writer-wins) → apply remote
 * changes locally → upload the merged file. Concurrent calls coalesce into a
 * no-op (on the cloud, one that `waitsItsTurn` runs after the current one);
 * failures are recorded on sync_config.lastError for the UI.
 */
export async function runSyncCycle(
  options: { waitsItsTurn?: boolean } = {},
): Promise<SyncCycleResult> {
  if (isRunning) return { success: true, skipped: 'no_changes' }

  const config = await getSyncConfig()
  if (!config.syncEnabled) return { success: false, skipped: 'disabled' }
  if (config.transport === 'cloud') return runCloudSyncCycle(options)

  const drive = await getDriveService()
  if (!drive) {
    await upsertSyncConfig({ lastError: 'not_connected' })
    return { success: false, skipped: 'not_connected', error: 'not_connected' }
  }

  isRunning = true
  const db = getRawDatabase()
  const cycleStartSeconds = Math.floor(Date.now() / 1000)

  try {
    const state = getSyncState()
    const remoteRef = await findLibraryFile(drive)
    const pendingBefore = getPendingKeys()

    // Fast path: nothing changed locally and the remote file version is the
    // one we last merged — no download or upload needed.
    if (
      pendingBefore.size === 0 &&
      remoteRef !== null &&
      remoteRef.fileId === state.remoteFileId &&
      remoteRef.version === state.remoteFileVersion
    ) {
      await upsertSyncConfig({ lastSyncAt: Date.now(), lastError: null })
      return { success: true, skipped: 'no_changes' }
    }

    const remote = remoteRef
      ? await downloadLibrary(drive, remoteRef.fileId)
      : null

    if (remote) adoptRemoteIdentities(remote)

    // Re-read after adoption: dirty keys may have been remapped to new uuids.
    const sentUpTo = getLatestPendingSeq()
    const dirtyKeys = getPendingKeys()
    const local = serializeLibrary(state.deviceId, state.deviceName, dirtyKeys)

    const { merged, applyOps } = mergeLibraries(
      local,
      remote,
      dirtyKeys,
      cycleStartSeconds,
    )
    const uploadNeeded = libraryChanged(merged, remote)

    const { reportedCount, appliedCount } = applyRemoteChanges(applyOps)

    let newRef = remoteRef
    if (uploadNeeded) {
      newRef = await uploadLibrary(drive, merged, remoteRef?.fileId ?? null)
      logger.info(
        `Library uploaded to Drive (version ${newRef.version}, ${merged.songs.length} songs, ${merged.schedules.length} schedules)`,
      )
    }
    updateRemoteFileRef(newRef?.fileId ?? null, newRef?.version ?? null)

    // Everything this cycle read is now in the shared file. An edit queued
    // after, even in the same second, stays queued for the next cycle.
    db.query('DELETE FROM sync_pending WHERE seq <= ?').run(sentUpTo)
    db.query('DELETE FROM sync_tombstones WHERE deleted_at < ?').run(
      cycleStartSeconds - TOMBSTONE_RETENTION_DAYS * 24 * 3600,
    )

    await upsertSyncConfig({ lastSyncAt: Date.now(), lastError: null })

    if (reportedCount > 0) broadcastSyncApplied(reportedCount)

    return { success: true, applied: appliedCount, pushed: uploadNeeded }
  } catch (error) {
    const message = toErrorMessage(error)
    logger.error(`Sync cycle failed: ${message}`)
    await upsertSyncConfig({ lastError: message })
    return { success: false, error: message }
  } finally {
    isRunning = false
  }
}
