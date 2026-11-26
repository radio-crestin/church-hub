import type { Bucket } from '../sync/createBucket'
import { SyncError } from '../sync/SyncError'
import { libraryKeys } from './libraryKeys'
import { sha256Hex } from './sha256Hex'

const SHARD_HASH = /^[0-9a-f]{64}$/

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(bytes).body?.pipeThrough(
    new DecompressionStream('gzip')
  )
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Stores a library shard a PC built, under the sha256 of its uncompressed
 * JSON: refused (400) unless it is that. Its name is its content, so a
 * shard already stored is left as it is, and it is cached forever.
 */
export async function putShard(
  bucket: Bucket,
  sourceId: string,
  hash: string,
  gzipped: Uint8Array
): Promise<void> {
  const json = SHARD_HASH.test(hash)
    ? await gunzip(gzipped).catch(() => null)
    : null
  if (!json || (await sha256Hex(json)) !== hash) {
    throw new SyncError(
      400,
      'invalid_shard',
      'The shard is not gzipped JSON with this sha256'
    )
  }
  await bucket.put(libraryKeys.shard(sourceId, hash), gzipped, {
    contentType: 'application/gzip',
    cacheControl: 'public, max-age=31536000, immutable',
    ifNoneMatch: '*',
  })
}
