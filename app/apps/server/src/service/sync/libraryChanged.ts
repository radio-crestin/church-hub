import { collectionOf, LIBRARY_COLLECTIONS } from './libraryCollections'
import { dirtyKey } from './mergeLibraries'
import type { LibraryFile } from './types'

/** Canonical, order-independent serialization used to detect real file changes. */
function canonicalize(file: LibraryFile): string {
  const sortByUuid = (a: { uuid: string }, b: { uuid: string }) =>
    a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0
  return JSON.stringify({
    schemaVersion: file.schemaVersion,
    ...Object.fromEntries(
      LIBRARY_COLLECTIONS.map(({ key }) => [
        key,
        [...collectionOf(file, key)].sort(sortByUuid),
      ]),
    ),
    tombstones: [...file.tombstones].sort((a, b) =>
      dirtyKey(a.entityType, a.uuid) < dirtyKey(b.entityType, b.uuid) ? -1 : 1,
    ),
  })
}

/**
 * True when the merged library differs from the shared file (Drive uploads
 * it then): the whole library compared, so only the Drive transport, which
 * rewrites the whole file, pays for it.
 */
export function libraryChanged(
  merged: LibraryFile,
  remote: LibraryFile | null,
): boolean {
  return remote === null || canonicalize(merged) !== canonicalize(remote)
}
