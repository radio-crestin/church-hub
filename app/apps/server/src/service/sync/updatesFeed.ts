import { getRawDatabase } from '../../db'

export interface SyncUpdateEntry {
  id: number
  entityType: string
  entityUuid: string
  localId: number | null
  changeKind: 'added' | 'updated' | 'removed' | 'conflict'
  title: string
  occurredAt: number
  seen: boolean
}

/**
 * Lists changes applied from other devices, newest first. With `unseenOnly`
 * the client uses this to render "new version" badges on songs and schedules.
 */
export function listSyncUpdates(options?: {
  unseenOnly?: boolean
  limit?: number
}): SyncUpdateEntry[] {
  const db = getRawDatabase()
  const limit = options?.limit ?? 100
  const where = options?.unseenOnly ? 'WHERE seen = 0' : ''

  return db
    .query<
      {
        id: number
        entity_type: string
        entity_uuid: string
        local_id: number | null
        change_kind: SyncUpdateEntry['changeKind']
        title: string
        occurred_at: number
        seen: number
      },
      [number]
    >(
      `SELECT id, entity_type, entity_uuid, local_id, change_kind, title, occurred_at, seen
         FROM sync_updates ${where} ORDER BY id DESC LIMIT ?`,
    )
    .all(limit)
    .map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityUuid: row.entity_uuid,
      localId: row.local_id,
      changeKind: row.change_kind,
      title: row.title,
      occurredAt: row.occurred_at,
      seen: row.seen === 1,
    }))
}

/**
 * Marks update entries as reviewed — all of them, or only those given (e.g.
 * when the user opens the affected song).
 */
export function markSyncUpdatesSeen(ids?: number[]): number {
  const db = getRawDatabase()
  if (!ids || ids.length === 0) {
    return db.query('UPDATE sync_updates SET seen = 1 WHERE seen = 0').run()
      .changes
  }
  const placeholders = ids.map(() => '?').join(', ')
  return db
    .query(`UPDATE sync_updates SET seen = 1 WHERE id IN (${placeholders})`)
    .run(...ids).changes
}
