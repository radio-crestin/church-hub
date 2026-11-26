import { dirtyKey } from './mergeLibraries'
import { getRawDatabase } from '../../db'

/**
 * Who made each unsynced local change (edits and deletions), by
 * `entityType:uuid`: a user's uuid, or null for the server itself.
 */
export function getChangeAuthors(): Map<string, string | null> {
  const rows = getRawDatabase()
    .query<
      { entity_type: string; entity_uuid: string; author: string | null },
      []
    >(
      `SELECT entity_type, entity_uuid, author FROM sync_pending
       UNION ALL
       SELECT entity_type, entity_uuid, author FROM sync_tombstones`,
    )
    .all()
  return new Map(
    rows.map((row) => [dirtyKey(row.entity_type, row.entity_uuid), row.author]),
  )
}
