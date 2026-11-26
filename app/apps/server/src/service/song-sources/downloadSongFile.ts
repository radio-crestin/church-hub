import { readArchiveChecksum } from './bundle/readArchiveChecksum'
import { fetchLink } from './links/fetchLink'
import { readPublishedChecksum } from './readPublishedChecksum'
import type { SongSource } from './types'

/**
 * A song-file source's `.chsongs` bytes, from its `url`. A built-in
 * source's file (from our `song-sources` release, which publishes a
 * `.sha256` next to each one) is refused when it is damaged or its manifest's
 * checksum is not the published one: a broken download, an upload caught
 * half-way, a stale copy. A shared link's file is read as it is.
 */
export async function downloadSongFile(
  source: SongSource,
): Promise<Uint8Array> {
  const archive = await fetchLink(source.url)
  if (source.origin !== 'built-in') return archive
  const [published, actual] = await Promise.all([
    readPublishedChecksum(source.url),
    readArchiveChecksum(archive),
  ])
  if (actual !== published) {
    throw new Error(
      `${source.name}: the downloaded song file does not match its checksum, so it was refused`,
    )
  }
  return archive
}
