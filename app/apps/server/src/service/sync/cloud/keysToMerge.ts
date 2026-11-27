import { getRawDatabase } from '../../../db'
import { collectionOf, LIBRARY_COLLECTIONS } from '../libraryCollections'
import { dirtyKey } from '../mergeLibraries'
import type { LibraryFile } from '../types'

/**
 * The rows a cloud round merges (`entityType:uuid`): the local edits, every
 * row and deletion the bucket changed since this server's seq, and the local
 * deletions. Any other row is the same on both sides, so the round leaves it
 * out rather than serialize the whole library (T-218).
 */
export function keysToMerge(
  dirtyKeys: ReadonlySet<string>,
  remote: LibraryFile | null,
): Set<string> {
  const keys = new Set(dirtyKeys)
  if (remote) {
    for (const { entityType, key } of LIBRARY_COLLECTIONS) {
      for (const item of collectionOf(remote, key)) {
        keys.add(dirtyKey(entityType, item.uuid))
      }
    }
    for (const tomb of remote.tombstones) {
      keys.add(dirtyKey(tomb.entityType, tomb.uuid))
    }
  }
  const localTombs = getRawDatabase()
    .query<{ entity_type: string; entity_uuid: string }, []>(
      'SELECT entity_type, entity_uuid FROM sync_tombstones',
    )
    .all()
  for (const tomb of localTombs) {
    keys.add(dirtyKey(tomb.entity_type, tomb.entity_uuid))
  }
  return keys
}
