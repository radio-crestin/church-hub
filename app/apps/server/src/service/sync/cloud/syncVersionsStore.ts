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
  type Row = {
    entity_type: string
    entity_uuid: string
    version: number
    deleted: number
  }
  const db = getRawDatabase()
  // Each key looked up by the table's primary key, never a scan of it.
  const rows = keys
    ? db
        .query<Row, [string]>(
          `SELECT v.entity_type, v.entity_uuid, v.version, v.deleted
             FROM json_each(?) k
             JOIN sync_versions v
               ON v.entity_type = substr(k.value, 1, instr(k.value, ':') - 1)
              AND v.entity_uuid = substr(k.value, instr(k.value, ':') + 1)`,
        )
        .all(JSON.stringify([...keys]))
    : db
        .query<Row, []>(
          'SELECT entity_type, entity_uuid, version, deleted FROM sync_versions',
        )
        .all()
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
