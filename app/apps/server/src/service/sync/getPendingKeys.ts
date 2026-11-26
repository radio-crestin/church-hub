import { dirtyKey } from './mergeLibraries'
import { getRawDatabase } from '../../db'

/** The unsynced local edits, as `entityType:uuid` keys. */
export function getPendingKeys(): Set<string> {
  const db = getRawDatabase()
  const rows = db
    .query<{ entity_type: string; entity_uuid: string }, []>(
      'SELECT entity_type, entity_uuid FROM sync_pending',
    )
    .all()
  return new Set(rows.map((row) => dirtyKey(row.entity_type, row.entity_uuid)))
}
