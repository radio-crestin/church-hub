import { churchPrefix } from './churchPrefix'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { churchStateKey } from './state/churchStateKey'
import { readChurch } from './state/readChurch'
import type { Head } from './types'

/** Readers revalidate head.json on every poll (an unchanged one is a 304). */
export const HEAD_CACHE_CONTROL = 'no-cache'

/** Re-publishes after concurrent writes; the next write publishes the rest. */
const MAX_PUBLISHES = 8

/**
 * Writes head.json from the church's state (at `etag`): the snapshot and
 * the segments after it. Two writers may PUT out of order, so each checks
 * the state's ETag after its PUT and writes again from the newer state if
 * it changed: the last one standing leaves the current head. Under a
 * sustained burst it stops after MAX_PUBLISHES; the burst's own later
 * writes publish the newer head.
 */
export async function publishHead(
  store: SyncStore,
  state: ChurchState,
  etag: string
): Promise<Head> {
  let church = { state, etag }
  for (let publish = 1; ; publish++) {
    const head: Head = {
      schemaVersion: 1,
      seq: church.state.seq,
      snapshot: church.state.snapshot,
      segments: church.state.segments,
    }
    const prefix = churchPrefix(church.state.id, church.state.pathSecret)
    await store.bucket.put(
      `${prefix}/head.json`,
      new TextEncoder().encode(JSON.stringify(head)),
      { contentType: 'application/json', cacheControl: HEAD_CACHE_CONTROL }
    )

    if (publish === MAX_PUBLISHES) return head
    const now = await store.states.etag(churchStateKey(church.state.id))
    if (now === church.etag) return head
    const latest = await readChurch(store, church.state.id)
    if (!latest) return head
    church = latest
  }
}
