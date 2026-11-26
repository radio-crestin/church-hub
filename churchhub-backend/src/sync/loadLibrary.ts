import { applySegment, type LibraryState } from './applySegment'
import { churchPrefix } from './churchPrefix'
import type { Bucket } from './createBucket'
import { gunzipJson } from './gzipJson'
import type { ChurchState } from './state/ChurchState'
import {
  COLLECTION_BY_TYPE,
  type CollectionName,
  type Segment,
  type Snapshot,
} from './types'

/** Tombstones older than this leave the snapshot (the app prunes them too). */
const TOMBSTONE_RETENTION_SECONDS = 90 * 24 * 3600

async function readObject<T>(bucket: Bucket, key: string): Promise<T> {
  const object = await bucket.get(key)
  if (!object) throw new Error(`Sync object missing: ${key}`)
  return gunzipJson<T>(object.bytes)
}

/**
 * The church's whole library at its latest segment: the last snapshot, then
 * every segment after it, read with the service's own credentials.
 */
export async function loadLibrary(
  bucket: Bucket,
  church: ChurchState
): Promise<Snapshot> {
  const prefix = churchPrefix(church.id, church.pathSecret)
  const base = church.snapshot
    ? await readObject<Snapshot>(bucket, `${prefix}/${church.snapshot.key}`)
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

  for (const log of church.segments) {
    const segment = await readObject<Segment>(bucket, `${prefix}/${log.key}`)
    applySegment(state, segment)
  }

  const cutoff = Math.floor(Date.now() / 1000) - TOMBSTONE_RETENTION_SECONDS
  return {
    schemaVersion: 1,
    updatedByDevice: 'Church Hub sync',
    seq: state.seq,
    ...(Object.fromEntries(
      Object.entries(state.collections).map(([name, rows]) => [
        name,
        [...rows.values()],
      ])
    ) as Record<CollectionName, Record<string, unknown>[]>),
    tombstones: [...state.tombstones.values()].filter(
      (tomb) => tomb.deletedAt > cutoff
    ),
    versions: state.versions,
  }
}
