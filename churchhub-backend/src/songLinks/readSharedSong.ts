import type { SyncStore } from '../sync/state/ChurchState'
import { SyncError } from '../sync/SyncError'
import { songLinkKey } from './songLinkKey'
import type { SharedSong } from './types'

const LINK_ID = /^[0-9a-f]{32}$/

/** The song behind a link; 404 when there is none (or no longer). */
export async function readSharedSong(
  store: SyncStore,
  linkId: string
): Promise<SharedSong> {
  const found = LINK_ID.test(linkId)
    ? await store.states.get(songLinkKey(linkId))
    : null
  if (!found) throw new SyncError(404, 'not_found', 'No song is shared by this link')
  return JSON.parse(new TextDecoder().decode(found.bytes)) as SharedSong
}
