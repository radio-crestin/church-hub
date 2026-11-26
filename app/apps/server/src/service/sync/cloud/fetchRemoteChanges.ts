import { type CloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { refreshReadUrl } from './refreshReadUrl'
import type { EntityVersion, Head, Segment, Snapshot } from './types'
import {
  COLLECTION_BY_TYPE,
  collectionOf,
  emptyLibrary,
  LIBRARY_COLLECTIONS,
} from '../libraryCollections'
import { dirtyKey } from '../mergeLibraries'
import type { LibraryAggregate, LibraryFile, LibraryTombstone } from '../types'

const READ_TIMEOUT_MS = 60_000

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
  knownEtag: string | null,
): Promise<{ head: Head | null; etag: string | null }> {
  let readUrl = identity.readUrl
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${readUrl}/head.json`, {
      headers:
        knownEtag && readUrl === identity.readUrl
          ? { 'If-None-Match': knownEtag }
          : {},
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    })
    if (response.status === 304) return { head: null, etag: knownEtag }
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
 * `whole`: the church's whole library, whatever this server has (to put a
 * refused change back as the church has it).
 */
export async function fetchRemoteChanges(
  identity: CloudIdentity,
  { whole = false } = {},
): Promise<RemoteChanges | null> {
  const since = whole ? 0 : identity.seq
  const { head, etag } = await readHead(
    identity,
    whole ? null : identity.headEtag,
  )
  if (!head) return null
  if (head.seq <= since) {
    // Our own write moved it: nothing new, but poll from this version on.
    if (!whole) await updateCloudIdentity({ headEtag: etag })
    return null
  }

  const fromSnapshot = head.snapshot !== null && since < head.snapshot.seq
  const rows = new Map(
    LIBRARY_COLLECTIONS.map(({ key }) => [
      key,
      new Map<string, LibraryAggregate>(),
    ]),
  )
  const tombstones = new Map<string, LibraryTombstone>()
  const versions = new Map<string, EntityVersion>()

  let after = since
  if (fromSnapshot && head.snapshot) {
    const snapshot = await readGzip<Snapshot>(
      `${identity.readUrl}/${head.snapshot.key}`,
    )
    for (const [key, collection] of rows) {
      for (const item of collectionOf(snapshot, key)) {
        collection.set(item.uuid, item)
      }
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
      const collection = rows.get(COLLECTION_BY_TYPE[change.type].key)
      if (!collection) continue
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

  const library = emptyLibrary()
  for (const [key, collection] of rows) {
    library[key] = [...collection.values()] as never
  }
  library.tombstones = [...tombstones.values()]
  return {
    seq: head.seq,
    headEtag: etag,
    library,
    versions,
    fromSnapshot,
  }
}
