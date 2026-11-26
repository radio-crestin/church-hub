import type { Bucket } from '../sync/createBucket'
import { SyncError } from '../sync/SyncError'
import { libraryKeys } from './libraryKeys'
import type { Catalog, CatalogEntry, LibraryManifest } from './types'

/** Short, like a manifest: a newly listed library shows within a minute. */
const CATALOG_CACHE_CONTROL = 'public, max-age=60'
/** Concurrent writers retry this many times before giving up (503 busy). */
const ATTEMPTS = 8

const EMPTY: Catalog = {
  format: 'church-hub-library-catalog',
  version: 1,
  libraries: [],
}

/** The catalog's entry for a manifest: null when it is not listed. */
function entryOf(manifest: LibraryManifest): CatalogEntry | null {
  if (manifest.listed !== true) return null
  return {
    sourceId: manifest.sourceId,
    name: String(manifest.name ?? manifest.sourceId).slice(0, 200),
    publisher: String(manifest.publisher ?? '').slice(0, 200),
    songCount: Number(manifest.songCount ?? manifest.songs.length),
    updatedAt: String(manifest.updatedAt ?? new Date().toISOString()),
  }
}

/**
 * Puts a library in the public catalog (`libraries/catalog.json`) when it
 * is listed, and takes it out when it is not, or (`null`) is deleted. The
 * write is conditional on the ETag read, retried when another one won;
 * nothing is written when the catalog already says so.
 */
export async function updateCatalog(
  bucket: Bucket,
  manifest: LibraryManifest | { sourceId: string; deleted: true }
): Promise<void> {
  const entry = 'deleted' in manifest ? null : entryOf(manifest)
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const found = await bucket.get(libraryKeys.catalog)
    const catalog: Catalog = found
      ? (JSON.parse(new TextDecoder().decode(found.bytes)) as Catalog)
      : EMPTY
    const others = catalog.libraries.filter(
      (library) => library.sourceId !== manifest.sourceId
    )
    if (!entry && others.length === catalog.libraries.length) return
    const libraries = entry ? [...others, entry] : others
    libraries.sort((a, b) => a.name.localeCompare(b.name))
    const written = await bucket.put(
      libraryKeys.catalog,
      new TextEncoder().encode(JSON.stringify({ ...EMPTY, libraries })),
      {
        contentType: 'application/json',
        cacheControl: CATALOG_CACHE_CONTROL,
        ...(found ? { ifMatch: found.etag } : { ifNoneMatch: '*' }),
      }
    )
    if (written !== null) return
  }
  throw new SyncError(503, 'busy', 'The catalog is busy, try again')
}
