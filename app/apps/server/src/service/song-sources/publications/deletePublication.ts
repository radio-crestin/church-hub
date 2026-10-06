import { getPublication } from './listPublications'
import { getRawDatabase } from '../../../db'
import { MANIFEST_FILE } from '../bundle/types'
import { getS3Storage } from '../storage/getS3Storage'
import { openBucket } from '../storage/openBucket'

/**
 * Stops publishing a category and takes its files off the bucket, manifest
 * first, so the shared link stops working before any song disappears.
 * Only the files this app uploaded are deleted, never the rest of the folder.
 */
export async function deletePublication(id: number): Promise<void> {
  const publication = getPublication(id)
  if (!publication) return
  const storage = getS3Storage()
  const manifest = publication.publishedManifest
  if (storage && manifest) {
    const bucket = openBucket(storage, publication.folder)
    await bucket.delete(MANIFEST_FILE)
    for (const song of manifest.songs) await bucket.delete(song.path)
  }
  getRawDatabase()
    .query('DELETE FROM song_source_publications WHERE id = ?')
    .run(id)
}
