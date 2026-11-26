import type { Bucket } from '../sync/createBucket'
import { SyncError } from '../sync/SyncError'
import { libraryKeys } from './libraryKeys'
import { pruneShards } from './pruneShards'
import { readManifest } from './readManifest'
import type { LibraryManifest } from './types'
import { updateCatalog } from './updateCatalog'

function changed(checksum: string | null): SyncError {
  return new SyncError(409, 'library_changed', 'The library changed meanwhile', {
    checksum,
  })
}

/**
 * Publishes a library's next manifest, built by a PC from the one with
 * `baseChecksum` (null: none yet). 409 library_changed, with the current
 * checksum, when someone published first: the PC builds it again from
 * theirs. The write is conditional on the ETag read, so two at once can't
 * both win. Every shard it lists must be stored already (putShard).
 */
export async function publishManifest(
  bucket: Bucket,
  next: LibraryManifest,
  baseChecksum: string | null
): Promise<void> {
  const { sourceId } = next
  const current = await readManifest(bucket, sourceId)
  const checksum = current?.manifest.checksum ?? null
  if (checksum !== baseChecksum) throw changed(checksum)

  const known = new Set(current?.manifest.shards.map((shard) => shard.path))
  for (const shard of next.shards) {
    if (known.has(shard.path)) continue
    const key = libraryKeys.shard(sourceId, shard.hash)
    if ((await bucket.etag(key)) === null) {
      throw new SyncError(
        400,
        'invalid_manifest',
        `Shard ${shard.hash} was not uploaded`
      )
    }
  }

  const written = await bucket.put(
    libraryKeys.manifest(sourceId),
    new TextEncoder().encode(JSON.stringify(next)),
    {
      contentType: 'application/json',
      cacheControl: 'public, max-age=60',
      ...(current ? { ifMatch: current.etag } : { ifNoneMatch: '*' }),
    }
  )
  if (written === null) {
    throw changed((await readManifest(bucket, sourceId))?.manifest.checksum ?? null)
  }
  await pruneShards(bucket, sourceId, [next, current?.manifest])
  await updateCatalog(bucket, next)
}
