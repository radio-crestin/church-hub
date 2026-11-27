import { requireCloudIdentity } from '../song-sources/shares/requireCloudIdentity'
import { getSongById } from '../songs/songs'
import {
  serviceError,
  syncServiceRequest,
} from '../sync/cloud/syncServiceRequest'

/** Stops a song's link: its page then says the song is no longer shared. */
export async function unshareSongLink(songId: number): Promise<void> {
  const identity = await requireCloudIdentity()
  const song = getSongById(songId)
  if (!song) throw new Error('song_not_found')
  const response = await syncServiceRequest(
    { serviceUrl: identity.serviceUrl, identity },
    'DELETE',
    `/song-links/${encodeURIComponent(song.uuid)}`,
  )
  if (response.status >= 400) throw serviceError(response)
}
