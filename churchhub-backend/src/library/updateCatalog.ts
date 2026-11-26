import type { Bucket } from '../sync/createBucket'
import type { LibraryManifest } from './types'

/**
 * After a library's manifest is written: the public catalog of listed
 * libraries follows it (T-176 fills this in). The curated library needs
 * nothing more.
 */
export async function updateCatalog(
  _bucket: Bucket,
  _manifest: LibraryManifest
): Promise<void> {}
