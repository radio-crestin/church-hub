import type { SyncEntityType } from '../../../db/schema/sync'
import type { LibraryAggregate, LibraryFile } from '../types'

/**
 * The sync service's bucket formats (churchhub-backend/src/sync/types.ts):
 * what this server reads straight from the bucket.
 */
export interface ObjectRef {
  seq: number
  /** Relative to the church's read URL. */
  key: string
}

/** `head.json`: polled every cycle (a 304 when unchanged). */
export interface Head {
  schemaVersion: 1
  seq: number
  snapshot: ObjectRef | null
  segments: ObjectRef[]
}

export interface PublishedChange {
  type: SyncEntityType
  uuid: string
  op: 'upsert' | 'delete'
  version: number
  /** The user (uuid) it was checked against; null: a church server. */
  author?: string | null
  data?: LibraryAggregate
  deletedAt?: number
}

/** `log/<seq>-<nonce>.json.gz`: one accepted write. */
export interface Segment {
  seq: number
  committedAt: number
  deviceId: string
  userId: string | null
  changes: PublishedChange[]
}

/** `snap/<seq>-<nonce>.json.gz`: the whole library at `seq`. */
export interface Snapshot extends LibraryFile {
  seq: number
  /** `type:uuid` → version. */
  versions: Record<string, number>
}

/** One change sent to `POST changes`. */
export interface ChangeInput {
  type: SyncEntityType
  uuid: string
  op: 'upsert' | 'delete'
  baseVersion: number
  /** The user (uuid) who made it; null: the server itself. */
  author: string | null
  data?: LibraryAggregate
  deletedAt?: number
}

/** A change the service refused (403): its author may not make it. */
export interface RejectedChange {
  type: SyncEntityType
  uuid: string
  permission: string
}

/** A row's central version, as `sync_versions` keeps it. */
export interface EntityVersion {
  version: number
  deleted: boolean
}
