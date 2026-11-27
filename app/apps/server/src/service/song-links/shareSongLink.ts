import { songLinkUrl } from './songLinkUrl'
import { toSharedSong } from './toSharedSong'
import type { SongLink } from './types'
import { requireCloudIdentity } from '../song-sources/shares/requireCloudIdentity'
import { getSongWithSlides } from '../songs/songs'
import {
  serviceError,
  syncServiceRequest,
} from '../sync/cloud/syncServiceRequest'

/**
 * Shares a song by link (T-177): the sync service keeps it as it reads now
 * for its public page. The same song always gets the same link, from any
 * device of the church; sharing it again updates the page.
 */
export async function shareSongLink(songId: number): Promise<SongLink> {
  const identity = await requireCloudIdentity()
  const song = getSongWithSlides(songId)
  if (!song) throw new Error('song_not_found')
  const response = await syncServiceRequest<{ linkId: string }>(
    { serviceUrl: identity.serviceUrl, identity },
    'PUT',
    `/song-links/${encodeURIComponent(song.uuid)}`,
    toSharedSong(song),
  )
  if (response.status >= 400) throw serviceError(response)
  return { url: songLinkUrl(response.body.linkId, identity.serviceUrl) }
}
