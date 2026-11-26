import { churchPrefix } from './churchPrefix'
import type { Bucket } from './createBucket'
import { loadLibrary } from './loadLibrary'
import { randomId } from './randomId'
import type { ChurchState } from './state/ChurchState'
import { writeSnapshot } from './writeSnapshot'

export interface PathMove {
  /** The prefix the church left: cleared by finishPathMove once saved. */
  oldPrefix: string
  /** Deletes the new snapshot, when the state write lost the race. */
  undo: () => Promise<void>
}

/**
 * Moves `church` (changed in place, inside an updateChurch) to a fresh path
 * secret: the whole library is written as one snapshot under the new
 * prefix, and the state points at it with no segments.
 */
export async function movePathSecret(
  bucket: Bucket,
  church: ChurchState
): Promise<PathMove> {
  const oldPrefix = churchPrefix(church.id, church.pathSecret)
  const snapshot = await loadLibrary(bucket, church)
  const pathSecret = randomId(32)
  const prefix = churchPrefix(church.id, pathSecret)
  const key = await writeSnapshot(bucket, prefix, {
    ...snapshot,
    seq: church.seq,
  })
  church.pathSecret = pathSecret
  church.snapshot = { seq: church.seq, key }
  church.segments = []
  church.updatedAt = Math.floor(Date.now() / 1000)
  return { oldPrefix, undo: () => bucket.delete(`${prefix}/${key}`) }
}
