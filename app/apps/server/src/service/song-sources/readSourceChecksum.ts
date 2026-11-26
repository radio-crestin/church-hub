import { parseManifest } from './bundle/parseManifest'
import { fetchLink } from './links/fetchLink'
import { findSongSource } from './listSongSources'
import { readManagedManifest } from './managed/readManagedManifest'
import type { SongSource } from './types'

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes).trim()

/** cantaricrestine.ro's song count for the hymnal, from a one-song page. */
async function cantariCrestineCount(url: string): Promise<string> {
  const onePage = new URL(url)
  onePage.searchParams.set('limita', '1')
  const body = JSON.parse(decode(await fetchLink(onePage.toString())))
  return `songs:${body?.paginatie?.total_rezultate ?? ''}`
}

/** A song file's checksum: our manifest's, or the `.sha256` next to the file. */
async function songFileChecksum(source: SongSource): Promise<string> {
  const managed = await readManagedManifest(source)
  if (managed) return managed.checksum
  return decode(await fetchLink(`${source.url}.sha256`)).split(/\s/)[0] ?? ''
}

/**
 * A short value that changes when a source's songs change, fetched without
 * downloading the songs: a managed source's manifest checksum, the
 * `.sha256` published next to an archive, a
 * shared folder's manifest checksum, or cantaricrestine.ro's song count.
 * '' when the source offers none (it is then checked at most daily).
 */
export async function readSourceChecksum(sourceId: string): Promise<string> {
  const source = findSongSource(sourceId)
  switch (source.format) {
    case 'song-bundle-file':
      return songFileChecksum(source)
    case 'song-bundle-folder':
      return parseManifest(decode(await fetchLink(source.url))).checksum ?? ''
    case 'cantaricrestine-api':
      return cantariCrestineCount(source.url)
  }
}
