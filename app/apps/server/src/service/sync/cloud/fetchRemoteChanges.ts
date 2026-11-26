import { type CloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { refreshReadUrl } from './refreshReadUrl'
import type { EntityVersion, Head, Segment, Snapshot } from './types'
import { LIBRARY_SCHEMA_VERSION } from '../constants'
import { dirtyKey } from '../mergeLibraries'
import type { LibraryAggregate, LibraryFile, LibraryTombstone } from '../types'

const READ_TIMEOUT_MS = 60_000

const COLLECTION_BY_TYPE = {
  song_category: 'categories',
  song_group: 'groups',
  song: 'songs',
  schedule: 'schedules',
} as const

/** What changed in the bucket since this server's seq. */
export interface RemoteChanges {
  seq: number
  headEtag: string | null
  /** The changed rows (the whole library when `fromSnapshot`). */
  library: LibraryFile
  versions: Map<string, EntityVersion>
  /** True when a snapshot was read: this server had nothing yet. */
  fromSnapshot: boolean
}

async function readGzip<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return JSON.parse(new TextDecoder().decode(Bun.gunzipSync(bytes))) as T
}

async function readHead(
  identity: CloudIdentity,
): Promise<{ head: Head | null; etag: string | null }> {
  let readUrl = identity.readUrl
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${readUrl}/head.json`, {
      headers:
        identity.headEtag && readUrl === identity.readUrl
          ? { 'If-None-Match': identity.headEtag }
          : {},
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    })
    if (response.status === 304) return { head: null, etag: identity.headEtag }
    if (response.ok) {
      return {
        head: (await response.json()) as Head,
        etag: response.headers.get('ETag'),
      }
    }
    // The old path is deleted after a rotation: ask where it moved.
    if (response.status !== 404 && response.status !== 403) {
      throw new Error(`GET head.json failed: ${response.status}`)
    }
    readUrl = await refreshReadUrl(identity)
    identity.readUrl = readUrl
  }
  throw new Error('head.json not found at the church path')
}

/**
 * Reads head.json straight from the bucket (never through the service) and,
 * when it moved past this server's seq, the segments after it: or the
 * snapshot first, when this server has nothing yet or fell behind a
 * compaction. Later segments win over earlier ones. Null when unchanged.
 */
export async function fetchRemoteChanges(
  identity: CloudIdentity,
): Promise<RemoteChanges | null> {
  const { head, etag } = await readHead(identity)
  if (!head) return null
  if (head.seq <= identity.seq) {
    // Our own write moved it: nothing new, but poll from this version on.
    await updateCloudIdentity({ headEtag: etag })
    return null
  }

  const fromSnapshot =
    head.snapshot !== null && identity.seq < head.snapshot.seq
  const library: LibraryFile = {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    updatedByDevice: '',
    categories: [],
    groups: [],
    songs: [],
    schedules: [],
    tombstones: [],
  }
  const rows = {
    categories: new Map<string, LibraryAggregate>(),
    groups: new Map<string, LibraryAggregate>(),
    songs: new Map<string, LibraryAggregate>(),
    schedules: new Map<string, LibraryAggregate>(),
  }
  const tombstones = new Map<string, LibraryTombstone>()
  const versions = new Map<string, EntityVersion>()

  let after = identity.seq
  if (fromSnapshot && head.snapshot) {
    const snapshot = await readGzip<Snapshot>(
      `${identity.readUrl}/${head.snapshot.key}`,
    )
    for (const name of Object.values(COLLECTION_BY_TYPE)) {
      for (const item of snapshot[name]) rows[name].set(item.uuid, item)
    }
    for (const tomb of snapshot.tombstones) {
      tombstones.set(dirtyKey(tomb.entityType, tomb.uuid), tomb)
    }
    for (const [key, version] of Object.entries(snapshot.versions)) {
      versions.set(key, { version, deleted: tombstones.has(key) })
    }
    after = head.snapshot.seq
  }

  for (const ref of head.segments.filter((s) => s.seq > after)) {
    const segment = await readGzip<Segment>(`${identity.readUrl}/${ref.key}`)
    for (const change of segment.changes) {
      const key = dirtyKey(change.type, change.uuid)
      const collection = rows[COLLECTION_BY_TYPE[change.type]]
      if (change.op === 'upsert' && change.data) {
        collection.set(change.uuid, change.data)
        tombstones.delete(key)
      } else {
        collection.delete(change.uuid)
        tombstones.set(key, {
          entityType: change.type,
          uuid: change.uuid,
          deletedAt: change.deletedAt ?? segment.committedAt,
        })
      }
      versions.set(key, {
        version: change.version,
        deleted: change.op === 'delete',
      })
    }
  }

  return {
    seq: head.seq,
    headEtag: etag,
    library: {
      ...library,
      categories: [...rows.categories.values()] as LibraryFile['categories'],
      groups: [...rows.groups.values()] as LibraryFile['groups'],
      songs: [...rows.songs.values()] as LibraryFile['songs'],
      schedules: [...rows.schedules.values()] as LibraryFile['schedules'],
      tombstones: [...tombstones.values()],
    },
    versions,
    fromSnapshot,
  }
}
