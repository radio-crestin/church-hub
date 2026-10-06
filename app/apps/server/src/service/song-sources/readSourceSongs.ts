import type { SongBundleSong } from './bundle/types'
import { readBundleFile } from './links/readBundleFile'
import { readBundleFolder } from './links/readBundleFolder'
import { listSongSources } from './listSongSources'

/**
 * The songs of a song-bundle source (a `.chsongs` file or a shared folder).
 * Read on the server, which holds the folder cache and needs no CORS.
 */
export function readSourceSongs(sourceId: string): Promise<SongBundleSong[]> {
  const source = listSongSources().find((s) => s.id === sourceId)
  if (!source) throw new Error(`Unknown song source: ${sourceId}`)
  if (source.format === 'song-bundle-file') return readBundleFile(source.url)
  if (source.format === 'song-bundle-folder') {
    return readBundleFolder(source.url)
  }
  throw new Error(`${source.name} is not a song bundle source`)
}
