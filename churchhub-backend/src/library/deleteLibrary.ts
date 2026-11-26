import type { Bucket } from '../sync/createBucket'
import { libraryKeys } from './libraryKeys'
import { updateCatalog } from './updateCatalog'

/**
 * Stops sharing a library: out of the catalog first, then its manifest
 * (readers stop finding it), then its shards.
 */
export async function deleteLibrary(
  bucket: Bucket,
  sourceId: string
): Promise<void> {
  await updateCatalog(bucket, { sourceId, deleted: true })
  await bucket.delete(libraryKeys.manifest(sourceId))
  const keys = await bucket.list(libraryKeys.prefix(sourceId))
  await Promise.all(keys.map((key) => bucket.delete(key)))
}
