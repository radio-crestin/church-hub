import { publishHead } from './publishHead'
import type { ChurchState, SyncStore } from './state/ChurchState'

/** Old-prefix objects deleted per move (the rest are unreferenced). */
const MAX_DELETES = 500

/**
 * Once a moved path is saved (at `etag`): head.json goes up under the new
 * prefix, then every object under the old one is deleted, so a device that
 * still knows the old path reads nothing new.
 */
export async function finishPathMove(
  store: SyncStore,
  state: ChurchState,
  etag: string,
  oldPrefix: string
): Promise<void> {
  await publishHead(store, state, etag)
  const stale = await store.bucket.list(`${oldPrefix}/`)
  for (const key of stale.slice(0, MAX_DELETES)) await store.bucket.delete(key)
}
