import type { ChurchState, SyncStore } from './ChurchState'
import { churchStateKey } from './churchStateKey'
import { encryptState } from './encryptState'

/**
 * Saves the state only if nobody changed it since it was read at `etag`
 * (null: only if the church doesn't exist yet). Returns the new ETag, or
 * null when another write got there first.
 */
export async function writeChurch(
  store: SyncStore,
  state: ChurchState,
  etag: string | null
): Promise<string | null> {
  return store.states.put(
    churchStateKey(state.id),
    await encryptState(state, store.secret),
    {
      contentType: 'application/octet-stream',
      cacheControl: 'no-store',
      ...(etag === null ? { ifNoneMatch: '*' as const } : { ifMatch: etag }),
    }
  )
}
