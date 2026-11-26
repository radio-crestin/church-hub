import type { LibraryInfo } from './buildLibrary'
import { byId } from './byId'
import { sha256Hex } from './sha256Hex'
import {
  LIBRARY_BUNDLE_FORMAT,
  LIBRARY_BUNDLE_VERSION,
  type LibraryManifest,
  type LibraryManifestShard,
  type LibraryManifestSong,
} from './types'

/** The manifest over these shards and songs, with its checksum. */
export async function toManifest(
  info: LibraryInfo,
  shards: LibraryManifestShard[],
  songs: LibraryManifestSong[],
): Promise<LibraryManifest> {
  const sorted = [...songs].sort(byId)
  return {
    format: LIBRARY_BUNDLE_FORMAT,
    version: LIBRARY_BUNDLE_VERSION,
    sourceId: info.sourceId,
    name: info.name,
    categoryName: info.categoryName,
    listed: info.listed,
    publisher: info.publisher,
    checksum: await sha256Hex(
      JSON.stringify([
        info.name,
        info.categoryName,
        sorted.map((song) => song.hash),
      ]),
    ),
    updatedAt: new Date().toISOString(),
    songCount: sorted.length,
    shards,
    songs: sorted,
  }
}
