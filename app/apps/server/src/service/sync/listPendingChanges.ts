import { COLLECTION_BY_TYPE } from './libraryCollections'
import type { LibraryCollectionKey } from './types'
import { getRawDatabase } from '../../db'
import type { SyncEntityType } from '../../db/schema/sync'

export interface PendingChangeEntry {
  entityType: SyncEntityType
  entityUuid: string
  /** Local row id (null if the row vanished between queueing and listing). */
  localId: number | null
  /** Display title of the changed entity. */
  title: string
  queuedAt: number
}

/** A pending row's local id and display title, by its sync identity. */
function titleQuery(entityType: SyncEntityType): string {
  const { table, uuidColumn, key } = COLLECTION_BY_TYPE[entityType]
  const title = TITLE_COLUMNS[key] ?? 'NULL'
  return `SELECT id, ${title} AS title FROM ${table} WHERE ${uuidColumn} = ?`
}

const TITLE_COLUMNS: Partial<Record<LibraryCollectionKey, string>> = {
  songs: 'title',
  categories: 'name',
  groups: 'canonical_title',
  schedules: 'title',
  tags: 'name',
  songBookmarks: '(SELECT title FROM songs WHERE songs.id = song_id)',
  songBookmarkNotes: 'content',
  bibleBookmarks: 'reference',
  bibleBookmarkNotes: 'content',
  playlists: 'name',
  settings: 'key',
  roles: 'name',
  users: 'name',
}

/**
 * Lists local changes waiting to be uploaded to Drive (the sync_pending dirty
 * set) with display titles, newest first — the "to send from this computer"
 * half of the sync changes list. Deletions are not listed: their tombstones
 * upload on the next cycle and the entity no longer exists to show.
 */
export function listPendingChanges(): PendingChangeEntry[] {
  const db = getRawDatabase()

  const rows = db
    .query<
      { entity_type: SyncEntityType; entity_uuid: string; queued_at: number },
      []
    >(
      'SELECT entity_type, entity_uuid, queued_at FROM sync_pending ORDER BY queued_at DESC',
    )
    .all()

  const entries: PendingChangeEntry[] = []
  for (const row of rows) {
    if (!(row.entity_type in COLLECTION_BY_TYPE)) continue
    const entity = db
      .query<{ id: number; title: string }, [string]>(
        titleQuery(row.entity_type),
      )
      .get(row.entity_uuid)
    entries.push({
      entityType: row.entity_type,
      entityUuid: row.entity_uuid,
      localId: entity?.id ?? null,
      title: entity?.title ?? '',
      queuedAt: row.queued_at,
    })
  }
  return entries
}
