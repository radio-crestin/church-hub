import { adoptRemoteIdentities } from '../../../apps/server/src/service/sync/adoptRemoteIdentities'
import { applyRemoteChanges } from '../../../apps/server/src/service/sync/applyRemoteChanges'
import { mergeLibraries } from '../../../apps/server/src/service/sync/mergeLibraries'
import { serializeLibrary } from '../../../apps/server/src/service/sync/serializeLibrary'
import { getSyncState } from '../../../apps/server/src/service/sync/syncStateStore'
import type { LibraryFile } from '../../../apps/server/src/service/sync/types'

/**
 * A device's first sync from a snapshot: the Drive cycle's steps between the
 * download and the upload (adopt, serialize, merge, apply), each timed.
 */
export function applySnapshot(remote: LibraryFile) {
  const phases: Record<string, number> = {}
  const timed = <T>(name: string, fn: () => T): T => {
    const start = performance.now()
    const value = fn()
    phases[name] = Math.round(performance.now() - start)
    return value
  }
  const state = getSyncState()
  timed('adopt', () => adoptRemoteIdentities(remote))
  const local = timed('serialize', () =>
    serializeLibrary(state.deviceId, state.deviceName, new Set()),
  )
  const now = Math.floor(Date.now() / 1000)
  const { applyOps } = timed('merge', () =>
    mergeLibraries(local, remote, new Set(), now),
  )
  const applied = timed('apply', () => applyRemoteChanges(applyOps))
  return { ...applied, phases }
}
