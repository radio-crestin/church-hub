/** Aggregates the sync engine carries (app: db/schema/sync.ts). */
export const ENTITY_TYPES = [
  'song',
  'song_category',
  'song_group',
  'schedule',
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

/** One change a client sends: an aggregate written or deleted. */
export interface ChangeInput {
  type: EntityType
  uuid: string
  op: 'upsert' | 'delete'
  /** The version the client last saw (0 for a row it never synced). */
  baseVersion: number
  /** The whole aggregate, for upserts (the app's Library* shapes). */
  data?: Record<string, unknown>
  /** Unix seconds of a delete, so clients can merge it last-writer-wins. */
  deletedAt?: number
}

/** A change as published in a log segment, with its new version. */
export interface PublishedChange {
  type: EntityType
  uuid: string
  op: 'upsert' | 'delete'
  version: number
  data?: Record<string, unknown>
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

export interface ObjectRef {
  seq: number
  /** Relative to the church's prefix. */
  key: string
}

/** `head.json`: what a reader fetches first, every few seconds. */
export interface Head {
  schemaVersion: 1
  seq: number
  snapshot: ObjectRef | null
  segments: ObjectRef[]
}

export interface LibraryTombstone {
  entityType: EntityType
  uuid: string
  deletedAt: number
}

/**
 * `snap/<seq>-<nonce>.json.gz`: the whole library at `seq`, in the LibraryFile
 * format the Drive sync writes, plus every aggregate's version.
 */
export interface Snapshot {
  schemaVersion: 1
  updatedByDevice: string
  seq: number
  categories: Record<string, unknown>[]
  groups: Record<string, unknown>[]
  songs: Record<string, unknown>[]
  schedules: Record<string, unknown>[]
  tombstones: LibraryTombstone[]
  /** `type:uuid` → version. */
  versions: Record<string, number>
}

/** The LibraryFile collection each entity type lives in. */
export const COLLECTION_BY_TYPE = {
  song_category: 'categories',
  song_group: 'groups',
  song: 'songs',
  schedule: 'schedules',
} as const satisfies Record<EntityType, keyof Snapshot>

/** The authenticated caller of a /sync route. */
export interface SyncCaller {
  churchId: string
  deviceId: string
  isServer: boolean
  /** The user it acts as: the device's, or the one the server names. */
  userId: string | null
}
