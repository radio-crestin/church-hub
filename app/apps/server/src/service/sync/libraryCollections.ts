import { LIBRARY_SCHEMA_VERSION } from './constants'
import {
  serializeBibleBookmarks,
  upsertBibleBookmark,
} from './records/bibleBookmarks'
import {
  serializeBookmarkNotes,
  upsertBookmarkNote,
} from './records/bookmarkNotes'
import { serializePlaylists, upsertPlaylist } from './records/playlists'
import { serializeRoles, upsertRole } from './records/roles'
import { serializeSettings, upsertSetting } from './records/settings'
import {
  serializeSongBookmarks,
  upsertSongBookmark,
} from './records/songBookmarks'
import { serializeTags, upsertTag } from './records/tags'
import { serializeUsers, upsertUser } from './records/users'
import { SYNCED_TABLES, type SyncedTable } from './syncedTables'
import type {
  LibraryAggregate,
  LibraryCollectionKey,
  LibraryFile,
} from './types'
import type { SyncEntityType } from '../../db/schema/sync'

/**
 * How the engine reads and writes the rows a collection holds. The first
 * four aggregates (songs, categories, groups, schedules) are serialized and
 * applied by serializeLibrary and applyRemoteChanges themselves.
 */
interface RecordIO {
  serialize: () => LibraryAggregate[]
  /** Writes the winning remote row; its local id, or null if left out. */
  upsert: (item: never) => number | null
}

export interface LibraryCollection extends SyncedTable {
  key: LibraryCollectionKey
  titleOf: (item: LibraryAggregate) => string
  records?: RecordIO
}

const field = (name: string) => (item: LibraryAggregate) =>
  String((item as unknown as Record<string, unknown>)[name] ?? '')

const COLLECTIONS: Record<
  SyncEntityType,
  Omit<LibraryCollection, keyof SyncedTable>
> = {
  role: {
    key: 'roles',
    titleOf: field('name'),
    records: { serialize: serializeRoles, upsert: upsertRole },
  },
  user: {
    key: 'users',
    titleOf: field('name'),
    records: { serialize: serializeUsers, upsert: upsertUser },
  },
  song_category: { key: 'categories', titleOf: field('name') },
  song_group: { key: 'groups', titleOf: field('canonicalTitle') },
  song_tag: {
    key: 'tags',
    titleOf: field('name'),
    records: { serialize: serializeTags, upsert: upsertTag },
  },
  song: { key: 'songs', titleOf: field('title') },
  song_bookmark: {
    key: 'songBookmarks',
    titleOf: field('songTitle'),
    records: { serialize: serializeSongBookmarks, upsert: upsertSongBookmark },
  },
  song_bookmark_note: {
    key: 'songBookmarkNotes',
    titleOf: field('content'),
    records: {
      serialize: () => serializeBookmarkNotes('song_bookmark_notes'),
      upsert: (note) => upsertBookmarkNote('song_bookmark_notes', note),
    },
  },
  bible_bookmark: {
    key: 'bibleBookmarks',
    titleOf: field('reference'),
    records: {
      serialize: serializeBibleBookmarks,
      upsert: upsertBibleBookmark,
    },
  },
  bible_bookmark_note: {
    key: 'bibleBookmarkNotes',
    titleOf: field('content'),
    records: {
      serialize: () => serializeBookmarkNotes('bible_bookmark_notes'),
      upsert: (note) => upsertBookmarkNote('bible_bookmark_notes', note),
    },
  },
  schedule: { key: 'schedules', titleOf: field('title') },
  music_playlist: {
    key: 'playlists',
    titleOf: field('name'),
    records: { serialize: serializePlaylists, upsert: upsertPlaylist },
  },
  setting: {
    key: 'settings',
    titleOf: field('uuid'),
    records: { serialize: serializeSettings, upsert: upsertSetting },
  },
}

/** Every synced collection, in apply order (a row's references first). */
export const LIBRARY_COLLECTIONS: LibraryCollection[] = SYNCED_TABLES.map(
  (synced) => ({ ...synced, ...COLLECTIONS[synced.entityType] }),
)

export const COLLECTION_BY_TYPE = Object.fromEntries(
  LIBRARY_COLLECTIONS.map((collection) => [collection.entityType, collection]),
) as Record<SyncEntityType, LibraryCollection>

/** A library with nothing in it. */
export function emptyLibrary(updatedByDevice = ''): LibraryFile {
  const library = {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    updatedByDevice,
    tombstones: [],
  } as unknown as LibraryFile
  for (const { key } of LIBRARY_COLLECTIONS) library[key] = []
  return library
}

/** A collection of a library written before it existed reads as empty. */
export function collectionOf(
  library: LibraryFile,
  key: LibraryCollectionKey,
): LibraryAggregate[] {
  return library[key] ?? []
}
