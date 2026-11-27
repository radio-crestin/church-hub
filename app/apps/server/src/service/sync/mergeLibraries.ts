import { LIBRARY_SCHEMA_VERSION, TOMBSTONE_RETENTION_DAYS } from './constants'
import {
  collectionOf,
  emptyLibrary,
  LIBRARY_COLLECTIONS,
} from './libraryCollections'
import type {
  ApplyOp,
  LibraryAggregate,
  LibraryFile,
  LibraryTombstone,
  MergeResult,
} from './types'

/** Per-device usage fields that should never surface a "new version" badge. */
const USAGE_FIELDS = new Set([
  'updatedAt',
  'createdAt',
  'presentationCount',
  'lastPresentedAt',
  'lastManualEdit',
  'modifiedByDevice',
])

function contentKey(item: LibraryAggregate): string {
  return JSON.stringify(item, (key, value) =>
    USAGE_FIELDS.has(key) ? undefined : value,
  )
}

export function dirtyKey(entityType: string, uuid: string): string {
  return `${entityType}:${uuid}`
}

/**
 * Merges the local library snapshot with the remote shared file.
 *
 * Pure function. Per aggregate (matched by uuid) the newer `updatedAt` wins
 * (last-writer-wins); deletions are represented by tombstones and compete on
 * their `deletedAt` timestamp. Produces the merged file to upload plus the
 * list of remote-driven changes to apply locally. `dirtyKeys` (unsynced local
 * edits, from sync_pending) only affects reporting: a remote win over a dirty
 * local row is flagged as a `conflict` instead of a plain `updated`.
 */
export function mergeLibraries(
  local: LibraryFile,
  remote: LibraryFile | null,
  dirtyKeys: Set<string>,
  nowSeconds: number,
): MergeResult {
  if (remote && remote.schemaVersion > LIBRARY_SCHEMA_VERSION) {
    throw new Error(
      `Remote library uses schema v${remote.schemaVersion}; update the app to sync`,
    )
  }

  const merged = emptyLibrary(local.updatedByDevice)
  const applyOps: ApplyOp[] = []
  const deleteOps: ApplyOp[] = []
  const tombstoneCutoff = nowSeconds - TOMBSTONE_RETENTION_DAYS * 24 * 3600

  const localTombs = new Map<string, LibraryTombstone>()
  for (const tomb of local.tombstones) {
    localTombs.set(dirtyKey(tomb.entityType, tomb.uuid), tomb)
  }
  const remoteTombs = new Map<string, LibraryTombstone>()
  for (const tomb of remote?.tombstones ?? []) {
    remoteTombs.set(dirtyKey(tomb.entityType, tomb.uuid), tomb)
  }
  const mergedTombs = new Map<string, LibraryTombstone>()

  for (const collection of LIBRARY_COLLECTIONS) {
    const localItems = new Map(
      collectionOf(local, collection.key).map((item) => [item.uuid, item]),
    )
    const remoteItems = new Map(
      (remote ? collectionOf(remote, collection.key) : []).map((item) => [
        item.uuid,
        item,
      ]),
    )

    const uuids = new Set<string>([...localItems.keys(), ...remoteItems.keys()])
    for (const [, tomb] of [...localTombs, ...remoteTombs]) {
      if (tomb.entityType === collection.entityType) uuids.add(tomb.uuid)
    }

    for (const uuid of uuids) {
      const key = dirtyKey(collection.entityType, uuid)
      const localItem = localItems.get(uuid)
      const remoteItem = remoteItems.get(uuid)
      const localTomb = localTombs.get(key)
      const remoteTomb = remoteTombs.get(key)

      // Effective state on each side: a live row beats an older tombstone.
      // Ties favor the live row (never destroy data on equal timestamps).
      const localRow =
        localItem && (!localTomb || localItem.updatedAt >= localTomb.deletedAt)
          ? localItem
          : undefined
      const localDeadAt = localRow ? null : (localTomb?.deletedAt ?? null)
      const remoteRow =
        remoteItem &&
        (!remoteTomb || remoteItem.updatedAt >= remoteTomb.deletedAt)
          ? remoteItem
          : undefined
      const remoteDeadAt = remoteRow ? null : (remoteTomb?.deletedAt ?? null)

      if (localRow && remoteRow) {
        if (remoteRow.updatedAt > localRow.updatedAt) {
          merged[collection.key].push(remoteRow as never)
          const silent = contentKey(remoteRow) === contentKey(localRow)
          applyOps.push({
            entityType: collection.entityType,
            op: 'upsert',
            uuid,
            data: remoteRow,
            changeKind: !silent && dirtyKeys.has(key) ? 'conflict' : 'updated',
            title: collection.titleOf(remoteRow),
            sourceDevice: remoteRow.modifiedByDevice ?? null,
            silent,
          })
        } else {
          // Local wins; clean local rows carry no attribution of their own —
          // keep the remote file's so the history isn't lost.
          if (localRow.modifiedByDevice == null && remoteRow.modifiedByDevice) {
            localRow.modifiedByDevice = remoteRow.modifiedByDevice
          }
          merged[collection.key].push(localRow as never)
        }
      } else if (localRow && remoteDeadAt !== null) {
        if (remoteDeadAt > localRow.updatedAt) {
          mergedTombs.set(key, {
            entityType: collection.entityType,
            uuid,
            deletedAt: remoteDeadAt,
          })
          deleteOps.push({
            entityType: collection.entityType,
            op: 'delete',
            uuid,
            changeKind: dirtyKeys.has(key) ? 'conflict' : 'removed',
            title: collection.titleOf(localRow),
          })
        } else {
          // Local edit is newer than the remote deletion — resurrect for all.
          merged[collection.key].push(localRow as never)
        }
      } else if (localRow) {
        merged[collection.key].push(localRow as never)
      } else if (remoteRow) {
        if (localDeadAt !== null && localDeadAt >= remoteRow.updatedAt) {
          // Local deletion is newer — propagate it instead of the row.
          mergedTombs.set(key, {
            entityType: collection.entityType,
            uuid,
            deletedAt: localDeadAt,
          })
        } else {
          merged[collection.key].push(remoteRow as never)
          applyOps.push({
            entityType: collection.entityType,
            op: 'upsert',
            uuid,
            data: remoteRow,
            changeKind: 'added',
            title: collection.titleOf(remoteRow),
            sourceDevice: remoteRow.modifiedByDevice ?? null,
          })
        }
      } else {
        // Dead on both sides (or only ever a tombstone): keep the newest marker.
        const deadAt = Math.max(localDeadAt ?? 0, remoteDeadAt ?? 0)
        if (deadAt > 0) {
          mergedTombs.set(key, {
            entityType: collection.entityType,
            uuid,
            deletedAt: deadAt,
          })
        }
      }
    }
  }

  merged.tombstones = [...mergedTombs.values()].filter(
    (tomb) => tomb.deletedAt > tombstoneCutoff,
  )

  return { merged, applyOps: [...applyOps, ...deleteOps] }
}
