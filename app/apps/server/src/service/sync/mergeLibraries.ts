import { LIBRARY_SCHEMA_VERSION, TOMBSTONE_RETENTION_DAYS } from './constants'
import type {
  ApplyOp,
  LibraryAggregate,
  LibraryFile,
  LibraryTombstone,
  MergeResult,
} from './types'
import type { SyncEntityType } from '../../db/schema/sync'

interface Collection {
  entityType: SyncEntityType
  key: 'categories' | 'groups' | 'songs' | 'schedules'
  titleOf: (item: LibraryAggregate) => string
}

/** Merge order respects FK-ish dependencies (songs need categories/groups). */
const COLLECTIONS: Collection[] = [
  {
    entityType: 'song_category',
    key: 'categories',
    titleOf: (item) => ('name' in item ? item.name : ''),
  },
  {
    entityType: 'song_group',
    key: 'groups',
    titleOf: (item) => ('canonicalTitle' in item ? item.canonicalTitle : ''),
  },
  {
    entityType: 'song',
    key: 'songs',
    titleOf: (item) => ('title' in item ? item.title : ''),
  },
  {
    entityType: 'schedule',
    key: 'schedules',
    titleOf: (item) => ('title' in item ? item.title : ''),
  },
]

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

/** Canonical, order-independent serialization used to detect real file changes. */
function canonicalize(file: LibraryFile): string {
  const sortByUuid = (a: { uuid: string }, b: { uuid: string }) =>
    a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0
  return JSON.stringify({
    schemaVersion: file.schemaVersion,
    categories: [...file.categories].sort(sortByUuid),
    groups: [...file.groups].sort(sortByUuid),
    songs: [...file.songs].sort(sortByUuid),
    schedules: [...file.schedules].sort(sortByUuid),
    tombstones: [...file.tombstones].sort((a, b) =>
      dirtyKey(a.entityType, a.uuid) < dirtyKey(b.entityType, b.uuid) ? -1 : 1,
    ),
  })
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

  const merged: LibraryFile = {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    updatedByDevice: local.updatedByDevice,
    categories: [],
    groups: [],
    songs: [],
    schedules: [],
    tombstones: [],
  }
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

  for (const collection of COLLECTIONS) {
    const localItems = new Map(
      local[collection.key].map((item) => [item.uuid, item]),
    )
    const remoteItems = new Map(
      (remote?.[collection.key] ?? []).map((item) => [item.uuid, item]),
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

  const uploadNeeded =
    remote === null || canonicalize(merged) !== canonicalize(remote)

  return { merged, applyOps: [...applyOps, ...deleteOps], uploadNeeded }
}
