import { gunzip } from './gzip'
import { sha256Hex } from './sha256Hex'
import {
  LIBRARY_SHARD_FORMAT,
  LIBRARY_SHARD_VERSION,
  type LibraryManifestShard,
  type LibraryShard,
} from './types'

/** A shard's songs from its gzipped bytes, refused unless its hash is the manifest's. */
export async function readLibraryShard(
  bytes: Uint8Array,
  entry: Pick<LibraryManifestShard, 'path' | 'hash'>,
): Promise<LibraryShard> {
  const json = await gunzip(bytes)
  if ((await sha256Hex(json)) !== entry.hash) {
    throw new Error(`Shard ${entry.path} does not match its hash`)
  }
  const shard = JSON.parse(new TextDecoder().decode(json)) as LibraryShard
  if (
    shard.format !== LIBRARY_SHARD_FORMAT ||
    shard.version > LIBRARY_SHARD_VERSION
  ) {
    throw new Error(`Shard ${entry.path} is not a shard this app can read`)
  }
  return shard
}
