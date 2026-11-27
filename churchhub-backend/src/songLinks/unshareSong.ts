import type { SyncStore } from '../sync/state/ChurchState'
import { songLinkId } from './songLinkId'
import { songLinkKey } from './songLinkKey'

/** Stops a song's link: its page answers 404 from now on. */
export async function unshareSong(
  store: SyncStore,
  churchId: string,
  songUuid: string
): Promise<void> {
  const linkId = await songLinkId(churchId, songUuid, store.secret)
  await store.states.delete(songLinkKey(linkId))
}
