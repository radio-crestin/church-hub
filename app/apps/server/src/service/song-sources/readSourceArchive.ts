import { fetchLink } from './links/fetchLink'
import { findSongSource } from './listSongSources'

/**
 * A song-file source's archive (`.chsongs`), downloaded by the server so a
 * link on any host works without CORS; the client unzips it.
 */
export function readSourceArchive(sourceId: string): Promise<Uint8Array> {
  const source = findSongSource(sourceId)
  if (source.format !== 'song-bundle-file') {
    throw new Error(`${source.name} is not a song file`)
  }
  return fetchLink(source.url)
}
