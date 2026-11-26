import { gzip } from './gzip'
import { lyricsFingerprint } from './lyricsFingerprint'
import { sha256Hex } from './sha256Hex'
import { shardCount, shardIndex } from './shardIndex'
import {
  LIBRARY_BUNDLE_FORMAT,
  LIBRARY_BUNDLE_VERSION,
  LIBRARY_SHARD_EXTENSION,
  LIBRARY_SHARD_FORMAT,
  LIBRARY_SHARD_VERSION,
  LIBRARY_SHARDS_DIR,
  type LibraryFiles,
  type LibraryManifestShard,
  type LibraryManifestSong,
  type LibraryShard,
  type LibraryShardSong,
  type LibrarySongInput,
} from './types'

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
  const count = shardCount(songs.length)
  const buckets: LibraryShardSong[][] = Array.from({ length: count }, () => [])
  for (const song of songs) {
    buckets[shardIndex(await sha256Hex(song.id), count)]?.push({
      id: song.id,
      title: song.title,
      hash: await sha256Hex(song.xml),
      fingerprint: (await lyricsFingerprint(song.lyrics)) ?? '',
      xml: song.xml,
    })
  }

  const shards = new Map<string, Uint8Array>()
  const shardEntries: LibraryManifestShard[] = []
  const songEntries: LibraryManifestSong[] = []
  for (const bucket of buckets) {
    if (bucket.length === 0) continue
    bucket.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const shard: LibraryShard = {
      format: LIBRARY_SHARD_FORMAT,
      version: LIBRARY_SHARD_VERSION,
      songs: bucket,
    }
    const json = new TextEncoder().encode(JSON.stringify(shard))
    const hash = await sha256Hex(json)
    const path = `${LIBRARY_SHARDS_DIR}/${hash}${LIBRARY_SHARD_EXTENSION}`
    const bytes = await gzip(json)
    shards.set(path, bytes)
    shardEntries.push({
      path,
      hash,
      size: bytes.length,
      songCount: bucket.length,
    })
    for (const song of bucket) {
      songEntries.push({
        id: song.id,
        title: song.title,
        path,
        hash: song.hash,
        fingerprint: song.fingerprint,
      })
    }
  }
  songEntries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  return {
    manifest: {
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
          songEntries.map((s) => s.hash),
        ]),
      ),
      updatedAt: new Date().toISOString(),
      songCount: songEntries.length,
      shards: shardEntries,
      songs: songEntries,
    },
    shards,
  }
}
