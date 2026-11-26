/** Aggregates the sync engine carries (app: db/schema/sync.ts). */
export const ENTITY_TYPES = [
  'song',
  'song_category',
  'song_group',
  'schedule',
  'song_tag',
  'song_bookmark',
  'song_bookmark_note',
  'bible_bookmark',
  'bible_bookmark_note',
  'music_playlist',
  'setting',
  'role',
  'user',
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

/** One change a client sends: an aggregate written or deleted. */
export interface ChangeInput {
  type: EntityType
  uuid: string
  op: 'upsert' | 'delete'
  /** The version the client last saw (0 for a row it never synced). */
  baseVersion: number
  /**
   * The user (uuid) who made it, named by a church server (it signed them
   * in); a phone's changes are always its own user's. Null: the server.
   */
  author: string | null
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
  /** The user (uuid) it was checked against; null: a church server. */
  author: string | null
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

/** The LibraryFile collection each entity type lives in. */
export const COLLECTION_BY_TYPE = {
  song_category: 'categories',
  song_group: 'groups',
  song: 'songs',
  schedule: 'schedules',
  song_tag: 'tags',
  song_bookmark: 'songBookmarks',
  song_bookmark_note: 'songBookmarkNotes',
  bible_bookmark: 'bibleBookmarks',
  bible_bookmark_note: 'bibleBookmarkNotes',
  music_playlist: 'playlists',
  setting: 'settings',
  role: 'roles',
  user: 'users',
} as const satisfies Record<EntityType, string>

export type CollectionName = (typeof COLLECTION_BY_TYPE)[EntityType]

/**
 * `snap/<seq>-<nonce>.json.gz`: the whole library at `seq`, in the LibraryFile
 * format the Drive sync writes (a collection per entity type), plus every
 * aggregate's version.
 */
export type Snapshot = {
  schemaVersion: 1
  updatedByDevice: string
  seq: number
  tombstones: LibraryTombstone[]
  /** `type:uuid` → version. */
  versions: Record<string, number>
} & Record<CollectionName, Record<string, unknown>[]>

/** The authenticated caller of a /sync route. */
export interface SyncCaller {
  churchId: string
  deviceId: string
  isServer: boolean
  /** The device's user; null for the church server (each change names one). */
  userId: string | null
}
