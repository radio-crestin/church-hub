import { byId } from './byId'
import { gzip } from './gzip'
import { sha256Hex } from './sha256Hex'
import {
  LIBRARY_SHARD_EXTENSION,
  LIBRARY_SHARD_FORMAT,
  LIBRARY_SHARD_VERSION,
  LIBRARY_SHARDS_DIR,
  type LibraryManifestShard,
  type LibraryShardSong,
} from './types'

/** A shard from its songs: sorted by id, named by its JSON's SHA-256, gzipped. */
export async function packShard(
  songs: LibraryShardSong[],
): Promise<{ entry: LibraryManifestShard; bytes: Uint8Array }> {
  const json = new TextEncoder().encode(
    JSON.stringify({
      format: LIBRARY_SHARD_FORMAT,
      version: LIBRARY_SHARD_VERSION,
      songs: [...songs].sort(byId),
    }),
  )
  const hash = await sha256Hex(json)
  const bytes = await gzip(json)
  return {
    entry: {
      path: `${LIBRARY_SHARDS_DIR}/${hash}${LIBRARY_SHARD_EXTENSION}`,
      hash,
      size: bytes.length,
      songCount: songs.length,
    },
    bytes,
  }
}
