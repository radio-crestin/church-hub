import { churchPrefix } from './churchPrefix'
import { loadLibrary } from './loadLibrary'
import { pruneObjects } from './pruneObjects'
import { publishHead } from './publishHead'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { updateChurch } from './state/updateChurch'
import { writeSnapshot } from './writeSnapshot'

/**
 * Writes a snapshot of the whole library at the latest segment and points
 * head.json at it, so a new device downloads one file instead of every
 * segment. Then deletes what the previous snapshot already replaced: the
 * service cleans up after itself, so no lifecycle rule can remove a segment
 * head.json still lists. Returns the snapshot's seq.
 */
export async function compact(
  store: SyncStore,
  churchId: string
): Promise<{ snapshotSeq: number; state: ChurchState }> {
  let previous = 0
  const { state, etag } = await updateChurch(
    store,
    churchId,
    async (church) => {
      previous = church.snapshot?.seq ?? 0
      if (church.seq === previous) return null

      const snapshot = await loadLibrary(store.bucket, church)
      const prefix = churchPrefix(church.id, church.pathSecret)
      const key = await writeSnapshot(store.bucket, prefix, snapshot)
      church.snapshot = { seq: snapshot.seq, key }
      church.segments = church.segments.filter((ref) => ref.seq > snapshot.seq)
      church.updatedAt = Math.floor(Date.now() / 1000)
      return {
        next: church,
        result: snapshot.seq,
        undo: () => store.bucket.delete(`${prefix}/${key}`),
      }
    }
  )
  await publishHead(store, state, etag)
  await pruneObjects(
    store.bucket,
    churchPrefix(state.id, state.pathSecret),
    previous
  )
  return { snapshotSeq: state.snapshot?.seq ?? 0, state }
}
