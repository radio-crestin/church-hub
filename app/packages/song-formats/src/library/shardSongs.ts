import type { LibraryInfo } from './buildLibrary'
import { packShard } from './packShard'
import { sha256Hex } from './sha256Hex'
import { shardCount, shardIndex } from './shardIndex'
import { toManifest } from './toManifest'
import type {
  LibraryFiles,
  LibraryManifestShard,
  LibraryManifestSong,
  LibraryShardSong,
} from './types'

/**
 * A library from songs already hashed: into a power-of-two number of shards
 * by the hash of their id, and the manifest listing each with its shard.
 */
export async function shardSongs(
  info: LibraryInfo,
  songs: LibraryShardSong[],
): Promise<LibraryFiles> {
  const count = shardCount(songs.length)
  const buckets: LibraryShardSong[][] = Array.from({ length: count }, () => [])
  for (const song of songs) {
    buckets[shardIndex(await sha256Hex(song.id), count)]?.push(song)
  }

  const shards = new Map<string, Uint8Array>()
  const shardEntries: LibraryManifestShard[] = []
  const songEntries: LibraryManifestSong[] = []
  for (const bucket of buckets) {
    if (bucket.length === 0) continue
    const { entry, bytes } = await packShard(bucket)
    shards.set(entry.path, bytes)
    shardEntries.push(entry)
    for (const song of bucket) {
      songEntries.push({
        id: song.id,
        title: song.title,
        path: entry.path,
        hash: song.hash,
        fingerprint: song.fingerprint,
      })
    }
  }
  return {
    manifest: await toManifest(info, shardEntries, songEntries),
    shards,
  }
}
