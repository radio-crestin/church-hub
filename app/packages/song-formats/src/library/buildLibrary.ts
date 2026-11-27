import { shardSongs } from './shardSongs'
import { toShardSong } from './toShardSong'
import type { LibraryFiles, LibrarySongInput } from './types'

export interface LibraryInfo {
  sourceId: string
  name: string
  categoryName: string
  listed: boolean
  publisher: string
}

/**
 * A library from its songs: songs sorted by id into a power-of-two number
 * of shards by the hash of their id, each shard named by the SHA-256 of its
 * JSON and gzipped, and the manifest listing every song with its shard.
 */
export async function buildLibrary(
  info: LibraryInfo,
  songs: LibrarySongInput[],
): Promise<LibraryFiles> {
  const hashed = []
  for (const song of songs) hashed.push(await toShardSong(song))
  return shardSongs(info, hashed)
}
