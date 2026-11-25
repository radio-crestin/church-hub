import { and, asc, eq, gt } from 'drizzle-orm'
import { applySegment, type LibraryState } from './applySegment'
import { churchPrefix } from './churchPrefix'
import type { Bucket } from './createBucket'
import type { SyncDb, SyncTables } from './db/SyncDb'
import { gunzipJson } from './gzipJson'
import { COLLECTION_BY_TYPE, type Segment, type Snapshot } from './types'

/** Tombstones older than this leave the snapshot (the app prunes them too). */
const TOMBSTONE_RETENTION_SECONDS = 90 * 24 * 3600

async function readObject<T>(bucket: Bucket, key: string): Promise<T> {
  const bytes = await bucket.get(key)
  if (!bytes) throw new Error(`Sync object missing: ${key}`)
  return gunzipJson<T>(bytes)
}

/**
 * The church's whole library at its latest segment: the last snapshot, then
 * every segment after it, read with the service's own credentials.
 */
export async function loadLibrary(
  db: SyncDb,
  bucket: Bucket,
  church: SyncTables['churches']['$inferSelect']
): Promise<Snapshot> {
  const { bucketObjects } = db.t
  const prefix = churchPrefix(church.id, church.pathSecret)
  const base = church.snapshotKey
    ? await readObject<Snapshot>(bucket, `${prefix}/${church.snapshotKey}`)
    : null

  const state: LibraryState = {
    seq: base?.seq ?? 0,
    collections: Object.fromEntries(
      Object.values(COLLECTION_BY_TYPE).map((name) => [
        name,
        new Map(
          (base?.[name] ?? []).map((item) => [item.uuid as string, item])
        ),
      ])
    ),
    tombstones: new Map(
      (base?.tombstones ?? []).map((tomb) => [
        `${tomb.entityType}:${tomb.uuid}`,
        tomb,
      ])
    ),
    versions: { ...(base?.versions ?? {}) },
  }

  const logs = await db.q
    .select({ key: bucketObjects.key })
    .from(bucketObjects)
    .where(
      and(
        eq(bucketObjects.churchId, church.id),
        eq(bucketObjects.kind, 'log'),
        gt(bucketObjects.seq, church.snapshotSeq)
      )
    )
    .orderBy(asc(bucketObjects.seq))
  for (const log of logs) {
    const segment = await readObject<Segment>(bucket, `${prefix}/${log.key}`)
    applySegment(state, segment)
  }

  const cutoff = Math.floor(Date.now() / 1000) - TOMBSTONE_RETENTION_SECONDS
  return {
    schemaVersion: 1,
    updatedByDevice: 'Church Hub sync',
    seq: state.seq,
    categories: [...state.collections.categories.values()],
    groups: [...state.collections.groups.values()],
    songs: [...state.collections.songs.values()],
    schedules: [...state.collections.schedules.values()],
    tombstones: [...state.tombstones.values()].filter(
      (tomb) => tomb.deletedAt > cutoff
    ),
    versions: state.versions,
  }
}
