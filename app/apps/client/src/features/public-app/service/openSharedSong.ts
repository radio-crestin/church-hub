import { getChurchBinding } from './churchBinding'
import { DEFAULT_SYNC_SERVICE_URL } from './defaultSyncServiceUrl'
import {
  fetchSharedSong,
  type SharedSongResult,
  sharedSongLinkId,
} from './sharedSong'

const BASE = import.meta.env.BASE_URL

/**
 * A song's link (T-177): its public page, or, on a device joined to the
 * church that shared it, the song in the app (null: the app starts, on
 * the song). Null too when the page is no song link.
 */
export async function openSharedSong(): Promise<SharedSongResult | null> {
  const linkId = sharedSongLinkId()
  if (!linkId) return null
  const binding = getChurchBinding()
  const serviceUrl =
    new URLSearchParams(window.location.search).get('s') ??
    binding?.serviceUrl ??
    DEFAULT_SYNC_SERVICE_URL
  const result = await fetchSharedSong(serviceUrl, linkId)
  if (result.kind === 'found' && binding?.churchId === result.song.churchId) {
    window.history.replaceState(
      null,
      '',
      `${BASE}songs/shared/${encodeURIComponent(result.song.songUuid)}`,
    )
    return null
  }
  return result
}
