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

const TITLE_QUERIES: Record<SyncEntityType, string> = {
  song: 'SELECT id, title FROM songs WHERE uuid = ?',
  song_category: 'SELECT id, name AS title FROM song_categories WHERE uuid = ?',
  song_group:
    'SELECT id, canonical_title AS title FROM song_groups WHERE uuid = ?',
  schedule: 'SELECT id, title FROM schedules WHERE uuid = ?',
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
    const titleQuery = TITLE_QUERIES[row.entity_type]
    if (!titleQuery) continue
    const entity = db
      .query<{ id: number; title: string }, [string]>(titleQuery)
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
