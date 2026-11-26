import { getRawDatabase } from '../../../db'

type Grants = 'role_permissions' | 'user_permissions'
type Owner = 'role_id' | 'user_id'

/** Each role's or user's permissions, by local id. */
export function readPermissions(table: Grants, owner: Owner) {
  const byOwner = new Map<number, string[]>()
  const rows = getRawDatabase()
    .query<{ owner: number; permission: string }, []>(
      `SELECT ${owner} AS owner, permission FROM ${table} ORDER BY permission`,
    )
    .all()
  for (const row of rows) {
    byOwner.set(row.owner, [...(byOwner.get(row.owner) ?? []), row.permission])
  }
  return byOwner
}

/** Replaces a role's or user's permissions with the synced ones. */
export function writePermissions(
  table: Grants,
  owner: Owner,
  ownerId: number,
  permissions: string[],
): void {
  const db = getRawDatabase()
  db.query(`DELETE FROM ${table} WHERE ${owner} = ?`).run(ownerId)
  const insert = db.query(
    `INSERT OR IGNORE INTO ${table} (${owner}, permission) VALUES (?, ?)`,
  )
  for (const permission of permissions) insert.run(ownerId, permission)
}
