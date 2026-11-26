import type { Bucket } from '../sync/createBucket'
import { libraryKeys } from './libraryKeys'
import type { LibraryManifest } from './types'

/** A library's manifest and its ETag; null before its first publish. */
export async function readManifest(
  bucket: Bucket,
  sourceId: string
): Promise<{ manifest: LibraryManifest; etag: string } | null> {
  const found = await bucket.get(libraryKeys.manifest(sourceId))
  if (!found) return null
  return {
    etag: found.etag,
    manifest: JSON.parse(
      new TextDecoder().decode(found.bytes)
    ) as LibraryManifest,
  }
}
