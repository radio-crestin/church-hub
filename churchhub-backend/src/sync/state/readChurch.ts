import type { ChurchState, SyncStore } from './ChurchState'
import { churchStateKey } from './churchStateKey'
import { decryptState } from './decryptState'

export interface ChurchVersion {
  state: ChurchState
  /** The state object's ETag: the next write is conditional on it. */
  etag: string
}

/** The church's state and its ETag, or null when no such church exists. */
export async function readChurch(
  store: SyncStore,
  churchId: string
): Promise<ChurchVersion | null> {
  // Ids are base64url (randomId): anything else can't name a state.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(churchId)) return null
  const object = await store.states.get(churchStateKey(churchId))
  if (!object) return null
  return {
    state: await decryptState(object.bytes, churchId, store.secret),
    etag: object.etag,
  }
}
