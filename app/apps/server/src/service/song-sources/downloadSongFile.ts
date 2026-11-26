import { fetchLink } from './links/fetchLink'
import { readManagedArchive } from './managed/readManagedArchive'
import { readManagedManifest } from './managed/readManagedManifest'
import type { SongSource } from './types'

/**
 * A song-file source's `.chsongs` bytes: a managed source's copy in our
 * bucket, checked against its manifest, or the file at the source's `url`
 * (for a managed source, while our bucket has no copy).
 */
export async function downloadSongFile(
  source: SongSource,
): Promise<Uint8Array> {
  const manifest = await readManagedManifest(source)
  return manifest && source.managed
    ? readManagedArchive(source.managed, manifest)
    : fetchLink(source.url)
}
