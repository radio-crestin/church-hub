import type { ChangeInput, EntityVersion } from './types'
import { LIBRARY_COLLECTIONS } from '../libraryCollections'
import { dirtyKey } from '../mergeLibraries'
import type { ApplyOp, LibraryAggregate, LibraryFile } from '../types'

/**
 * The local changes to publish after a merge: every edited row that is still
 * this server's version (the remote one did not win it), and every local
 * deletion not yet published. Each carries the central version it was made
 * on, so the service can refuse it if someone changed the row since, and
 * its author, whose permissions the service checks it against. Roles and
 * users go first: a change later in the batch may be by a user they add.
 */
export function buildPushChanges(
  merged: LibraryFile,
  local: LibraryFile,
  dirtyKeys: Set<string>,
  applyOps: ApplyOp[],
  versions: Map<string, EntityVersion>,
  authors: Map<string, string | null>,
): ChangeInput[] {
  const remoteWon = new Set(
    applyOps.map((op) => dirtyKey(op.entityType, op.uuid)),
  )
  const baseVersion = (key: string) => versions.get(key)?.version ?? 0

  const changes: ChangeInput[] = []
  for (const { entityType: type, key: collection } of LIBRARY_COLLECTIONS) {
    for (const item of merged[collection] as LibraryAggregate[]) {
      const key = dirtyKey(type, item.uuid)
      if (!dirtyKeys.has(key) || remoteWon.has(key)) continue
      changes.push({
        type,
        uuid: item.uuid,
        op: 'upsert',
        baseVersion: baseVersion(key),
        author: authors.get(key) ?? null,
        data: item,
      })
    }
  }

  const mergedTombs = new Set(
    merged.tombstones.map((t) => dirtyKey(t.entityType, t.uuid)),
  )
  for (const tomb of local.tombstones) {
    const key = dirtyKey(tomb.entityType, tomb.uuid)
    if (remoteWon.has(key) || versions.get(key)?.deleted) continue
    // A row resurrected by a newer edit is published as an upsert above.
    if (!mergedTombs.has(key)) continue
    changes.push({
      type: tomb.entityType,
      uuid: tomb.uuid,
      op: 'delete',
      baseVersion: baseVersion(key),
      author: authors.get(key) ?? null,
      deletedAt: tomb.deletedAt,
    })
  }
  return changes
}
