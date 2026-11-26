import type { LibraryInfo } from './buildLibrary'
import { packShard } from './packShard'
import { sha256Hex } from './sha256Hex'
import { shardCount, shardIndex } from './shardIndex'
import { shardSongs } from './shardSongs'
import { toManifest } from './toManifest'
import { toShardSong } from './toShardSong'
import type {
  LibraryFiles,
  LibraryManifest,
  LibraryManifestShard,
  LibraryShard,
  LibrarySongInput,
} from './types'

/**
 * A library with one song added, or replaced when its id is already there,
 * from its published manifest (null: an empty library). Only the song's
 * own shard is read and rebuilt; every shard is, only when the library
 * crosses a power of two and the shard count changes. `shards` holds just
 * the new shards to upload.
 */
export async function upsertLibrarySong(
  manifest: LibraryManifest | null,
  info: LibraryInfo,
  input: LibrarySongInput,
  readShard: (entry: LibraryManifestShard) => Promise<LibraryShard>,
): Promise<LibraryFiles> {
  const song = await toShardSong(input)
  const songs = manifest?.songs ?? []
  const existing = songs.find((entry) => entry.id === song.id)
  const count = shardCount(songs.length + (existing ? 0 : 1))

  if (!manifest || count !== shardCount(songs.length)) {
    const all = []
    for (const shard of manifest?.shards ?? []) {
      all.push(...(await readShard(shard)).songs)
    }
    return shardSongs(info, [
      ...all.filter((other) => other.id !== song.id),
      song,
    ])
  }

  const target = shardIndex(await sha256Hex(song.id), count)
  let oldShard = manifest.shards.find((shard) => shard.path === existing?.path)
  if (!oldShard) {
    for (const shard of manifest.shards) {
      const first = songs.find((entry) => entry.path === shard.path)
      if (first && shardIndex(await sha256Hex(first.id), count) === target) {
        oldShard = shard
        break
      }
    }
  }
  const shardContent = oldShard ? (await readShard(oldShard)).songs : []
  const { entry, bytes } = await packShard([
    ...shardContent.filter((other) => other.id !== song.id),
    song,
  ])

  const songEntry = {
    id: song.id,
    title: song.title,
    path: entry.path,
    hash: song.hash,
    fingerprint: song.fingerprint,
  }
  const nextSongs = songs
    .filter((other) => other.id !== song.id)
    .map((other) =>
      other.path === oldShard?.path ? { ...other, path: entry.path } : other,
    )
  nextSongs.push(songEntry)
  const nextShards = oldShard
    ? manifest.shards.map((shard) => (shard === oldShard ? entry : shard))
    : [...manifest.shards, entry]

  return {
    manifest: await toManifest(info, nextShards, nextSongs),
    shards: new Map([[entry.path, bytes]]),
  }
}
