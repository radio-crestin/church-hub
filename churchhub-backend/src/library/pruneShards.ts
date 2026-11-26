import type { Bucket } from '../sync/createBucket'
import { libraryKeys } from './libraryKeys'
import type { LibraryManifest } from './types'

/**
 * Deletes the library's shards that neither its new manifest nor the one
 * before lists: a reader still holding the previous manifest finds every
 * shard it names.
 */
export async function pruneShards(
  bucket: Bucket,
  sourceId: string,
  manifests: Array<LibraryManifest | undefined>
): Promise<void> {
  const keep = new Set(
    manifests.flatMap((manifest) =>
      (manifest?.shards ?? []).map((shard) =>
        libraryKeys.shard(sourceId, shard.hash)
      )
    )
  )
  const keys = await bucket.list(libraryKeys.shardsPrefix(sourceId))
  await Promise.all(
    keys.filter((key) => !keep.has(key)).map((key) => bucket.delete(key))
  )
}
