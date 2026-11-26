import type { EntityVersion } from './types'
import { getRawDatabase } from '../../../db'
import { dirtyKey } from '../mergeLibraries'

/**
 * The rows' central versions, by `entityType:uuid`: those of `keys`, or
 * every row's.
 */
export function getSyncVersions(
  keys?: ReadonlySet<string>,
): Map<string, EntityVersion> {
  const only = keys ? JSON.stringify([...keys]) : null
  const rows = getRawDatabase()
    .query<
      {
        entity_type: string
        entity_uuid: string
        version: number
        deleted: number
      },
      [string | null, string | null]
    >(
      `SELECT entity_type, entity_uuid, version, deleted FROM sync_versions
        WHERE ? IS NULL
           OR entity_type || ':' || entity_uuid IN (SELECT value FROM json_each(?))`,
    )
    .all(only, only)
  return new Map(
    rows.map((row) => [
      dirtyKey(row.entity_type, row.entity_uuid),
      { version: row.version, deleted: row.deleted === 1 },
    ]),
  )
}

/** Records the versions the service published or accepted. */
export function setSyncVersions(versions: Map<string, EntityVersion>): void {
  const db = getRawDatabase()
  const upsert = db.query(
    `INSERT INTO sync_versions (entity_type, entity_uuid, version, deleted)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (entity_type, entity_uuid) DO UPDATE SET
       version = excluded.version, deleted = excluded.deleted`,
  )
  db.transaction(() => {
    for (const [key, { version, deleted }] of versions) {
      const separator = key.indexOf(':')
      upsert.run(
        key.slice(0, separator),
        key.slice(separator + 1),
        version,
        deleted ? 1 : 0,
      )
    }
  })()
}

/** Forgets every version (the church was disconnected). */
export function clearSyncVersions(): void {
  getRawDatabase().run('DELETE FROM sync_versions')
}
