import { getRawDatabase } from '../../../db'

/**
 * Before a named row (a tag, a role) is written by uuid: a local row with
 * the same name under another uuid is the same thing made on two devices,
 * so it takes the remote uuid instead of becoming a duplicate. When this
 * device already has the remote uuid too, the other row is renamed, so the
 * unique name never stops the sync.
 */
export function adoptByName(table: string, uuid: string, name: string): void {
  const db = getRawDatabase()
  const twin = db
    .query<{ id: number }, [string, string]>(
      `SELECT id FROM ${table} WHERE name = ? AND uuid != ?`,
    )
    .get(name, uuid)
  if (!twin) return
  const hasUuid = db
    .query<{ id: number }, [string]>(`SELECT id FROM ${table} WHERE uuid = ?`)
    .get(uuid)
  if (hasUuid) {
    db.query(
      `UPDATE ${table} SET name = name || ' (' || id || ')' WHERE id = ?`,
    ).run(twin.id)
  } else {
    db.query(`UPDATE ${table} SET uuid = ? WHERE id = ?`).run(uuid, twin.id)
  }
}
