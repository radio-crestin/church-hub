import type { Publication, PublicationView } from './types'
import { MANIFEST_FILE } from '../bundle/types'
import { openBucket } from '../storage/openBucket'
import type { S3Storage } from '../storage/types'

/** A publication with its share link, for the client. */
export function toPublicationView(
  publication: Publication,
  storage: S3Storage | null,
): PublicationView {
  return {
    id: publication.id,
    categoryId: publication.categoryId,
    categoryName: publication.categoryName,
    shareUrl: storage
      ? openBucket(storage, publication.folder).publicUrl(MANIFEST_FILE)
      : null,
    songCount: publication.publishedManifest?.songs.length ?? 0,
    lastSyncedAt: publication.lastSyncedAt,
    lastError: publication.lastError,
  }
}
