import type { SongBundleFile } from './bundle/types'
import { readBundleFolder } from './links/readBundleFolder'
import { findSongSource } from './listSongSources'

/**
 * The song files of a shared folder source, read on the server, which keeps
 * the folder cache (only changed songs are downloaded).
 */
export function readSourceSongs(sourceId: string): Promise<SongBundleFile[]> {
  const source = findSongSource(sourceId)
  if (source.format !== 'song-bundle-folder') {
    throw new Error(`${source.name} is not a shared folder`)
  }
  return readBundleFolder(source.url)
}
