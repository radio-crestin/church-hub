import { LIBRARY_SHARD_SIZE } from './types'

/**
 * How many shards a library of `songCount` songs has: a power of two, so it
 * changes only when the library doubles or halves, and each shard holds
 * 250 to 500 songs.
 */
export function shardCount(songCount: number): number {
  let count = 1
  while (count * LIBRARY_SHARD_SIZE < songCount) count *= 2
  return count
}

/**
 * The shard a song goes in: the first 8 hex digits of its id's SHA-256 as a
 * number, modulo the shard count. Depends only on the id, so adding or
 * editing a song rewrites only its own shard.
 */
export function shardIndex(idHash: string, count: number): number {
  return Number.parseInt(idHash.slice(0, 8), 16) % count
}
