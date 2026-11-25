import { churchPrefix } from './churchPrefix'
import { loadLibrary } from './loadLibrary'
import { publishHead } from './publishHead'
import { randomId } from './randomId'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { updateChurch } from './state/updateChurch'
import { writeSnapshot } from './writeSnapshot'

/** Old-prefix objects deleted per rotation (the rest are unreferenced). */
const MAX_DELETES = 500

/**
 * Moves the church to a fresh path secret, so a revoked device that still
 * knows the old path reads nothing new: the whole library is written as one
 * snapshot under the new prefix, the state switches to it, then every
 * object under the old prefix is deleted. Remaining devices learn the new
 * path from their next write or `GET path`.
 */
export async function rotatePath(
  store: SyncStore,
  churchId: string
): Promise<ChurchState> {
  let oldPrefix = ''
  const { state, etag } = await updateChurch(
    store,
    churchId,
    async (church) => {
      oldPrefix = churchPrefix(church.id, church.pathSecret)
      const snapshot = await loadLibrary(store.bucket, church)
      const pathSecret = randomId(32)
      const prefix = churchPrefix(church.id, pathSecret)
      const key = await writeSnapshot(store.bucket, prefix, {
        ...snapshot,
        seq: church.seq,
      })
      church.pathSecret = pathSecret
      church.snapshot = { seq: church.seq, key }
      church.segments = []
      church.updatedAt = Math.floor(Date.now() / 1000)
      return {
        next: church,
        result: pathSecret,
        undo: () => store.bucket.delete(`${prefix}/${key}`),
      }
    }
  )
  await publishHead(store, state, etag)

  const stale = await store.bucket.list(`${oldPrefix}/`)
  for (const key of stale.slice(0, MAX_DELETES)) await store.bucket.delete(key)
  return state
}
