import type { SyncStore } from '../sync/state/ChurchState'
import { songLinkId } from './songLinkId'
import { songLinkKey } from './songLinkKey'
import type { SharedSong, SharedSongInput } from './types'

/** Keeps the song for its link (again, when shared before); its link id. */
export async function shareSong(
  store: SyncStore,
  churchId: string,
  songUuid: string,
  input: SharedSongInput
): Promise<string> {
  const linkId = await songLinkId(churchId, songUuid, store.secret)
  const song: SharedSong = {
    format: 'church-hub-shared-song',
    version: 1,
    churchId,
    songUuid,
    ...input,
    sharedAt: Date.now(),
  }
  await store.states.put(
    songLinkKey(linkId),
    new TextEncoder().encode(JSON.stringify(song)),
    { contentType: 'application/json', cacheControl: 'no-store' }
  )
  return linkId
}
