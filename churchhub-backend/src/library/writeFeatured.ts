import type { Bucket } from '../sync/createBucket'
import { SyncError } from '../sync/SyncError'
import { libraryKeys } from './libraryKeys'
import type { FeaturedSource, FeaturedSources } from './types'

/**
 * Publishes the sources every app lists. Each must be published already
 * (its manifest in the bucket), so no app is offered a library it can't
 * read; 400 names the first one that isn't.
 */
export async function writeFeatured(
  bucket: Bucket,
  sources: FeaturedSource[]
): Promise<FeaturedSources> {
  for (const source of sources) {
    if ((await bucket.etag(libraryKeys.manifest(source.sourceId))) === null) {
      throw new SyncError(
        400,
        'not_published',
        `${source.sourceId} has no published library yet`
      )
    }
  }
  const featured: FeaturedSources = {
    format: 'church-hub-featured-sources',
    version: 1,
    updatedAt: new Date().toISOString(),
    sources,
  }
  await bucket.put(
    libraryKeys.featured,
    new TextEncoder().encode(JSON.stringify(featured)),
    { contentType: 'application/json', cacheControl: 'public, max-age=60' }
  )
  return featured
}
