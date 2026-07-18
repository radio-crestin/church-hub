import { adoptRemoteIdentities } from './adoptRemoteIdentities'
import { applyRemoteChanges } from './applyRemoteChanges'
import { TOMBSTONE_RETENTION_DAYS } from './constants'
import {
  downloadLibrary,
  findLibraryFile,
  uploadLibrary,
} from './driveLibraryFile'
import { dirtyKey, mergeLibraries } from './mergeLibraries'
import { serializeLibrary } from './serializeLibrary'
import { getSyncConfig, upsertSyncConfig } from './syncConfigStore'
import { getSyncState, updateRemoteFileRef } from './syncStateStore'
import type { SyncCycleResult } from './types'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'
import { broadcastSyncApplied } from '../../websocket'
import { getDriveService } from '../backup/getDriveService'

const logger = createLogger('sync')

let isRunning = false

function getPendingKeys(): Set<string> {
  const db = getRawDatabase()
  const rows = db
    .query<{ entity_type: string; entity_uuid: string }, []>(
      'SELECT entity_type, entity_uuid FROM sync_pending',
    )
    .all()
  return new Set(rows.map((row) => dirtyKey(row.entity_type, row.entity_uuid)))
}

/**
 * Runs one full sync cycle against the shared Drive library file:
 * download → adopt identities → merge (last-writer-wins) → apply remote
 * changes locally → upload the merged file. Concurrent calls coalesce into a
 * no-op; failures are recorded on sync_config.lastError for the UI.
 */
export async function runSyncCycle(): Promise<SyncCycleResult> {
  if (isRunning) return { success: true, skipped: 'no_changes' }

  const config = await getSyncConfig()
  if (!config.syncEnabled) return { success: false, skipped: 'disabled' }

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
    const dirtyKeys = getPendingKeys()
    const local = serializeLibrary(state.deviceId)

    const { merged, applyOps, uploadNeeded } = mergeLibraries(
      local,
      remote,
      dirtyKeys,
      cycleStartSeconds,
    )

    const { reportedCount, appliedCount } = applyRemoteChanges(applyOps)

    let newRef = remoteRef
    if (uploadNeeded) {
      newRef = await uploadLibrary(drive, merged, remoteRef?.fileId ?? null)
      logger.info(
        `Library uploaded to Drive (version ${newRef.version}, ${merged.songs.length} songs, ${merged.schedules.length} schedules)`,
      )
    }
    updateRemoteFileRef(newRef?.fileId ?? null, newRef?.version ?? null)

    // Everything queued before this cycle is now reflected in the shared file.
    db.query('DELETE FROM sync_pending WHERE queued_at <= ?').run(
      cycleStartSeconds,
    )
    db.query('DELETE FROM sync_tombstones WHERE deleted_at < ?').run(
      cycleStartSeconds - TOMBSTONE_RETENTION_DAYS * 24 * 3600,
    )

    await upsertSyncConfig({ lastSyncAt: Date.now(), lastError: null })

    if (reportedCount > 0) broadcastSyncApplied(reportedCount)

    return { success: true, applied: appliedCount, pushed: uploadNeeded }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`Sync cycle failed: ${message}`)
    await upsertSyncConfig({ lastError: message })
    return { success: false, error: message }
  } finally {
    isRunning = false
  }
}
