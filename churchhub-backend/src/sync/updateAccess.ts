import { and, eq, inArray } from 'drizzle-orm'
import type { SyncDb, SyncQuery, SyncStatement } from './db/SyncDb'
import type { Access } from './parseAccess'

/** Rows per multi-row insert, under D1's 100 bound parameters. */
const ROWS_PER_INSERT = 30
/** Ids per delete, under the same limit. */
const IDS_PER_DELETE = 90

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Replaces the church's central roles and users with the PC's, the authority
 * the service checks every write against. A row's version goes up only when
 * it really changed; roles and users the PC no longer has are removed.
 * Returns how many rows changed.
 */
export async function updateAccess(
  db: SyncDb,
  churchId: string,
  access: Access
): Promise<{ roles: number; users: number }> {
  const { rolePermissions, roles, userPermissions, users } = db.t
  const now = Math.floor(Date.now() / 1000)
  // Built on the query builder `atomic` hands over (a transaction's, on
  // Postgres), so they are collected as functions of it.
  const statements: ((q: SyncQuery) => SyncStatement)[] = []

  const currentRoles = await db.q
    .select()
    .from(roles)
    .where(eq(roles.churchId, churchId))
  const currentRolePermissions = await db.q
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.churchId, churchId))
  let changedRoles = 0
  for (const role of access.roles) {
    const current = currentRoles.find((r) => r.id === role.id)
    const granted = currentRolePermissions
      .filter((p) => p.roleId === role.id)
      .map((p) => p.permission)
      .sort()
    if (
      current?.name === role.name &&
      JSON.stringify(granted) === JSON.stringify(role.permissions)
    ) {
      continue
    }
    changedRoles++
    const version = (current?.version ?? 0) + 1
    statements.push(
      (q) =>
        q
          .insert(roles)
          .values({
            churchId,
            id: role.id,
            name: role.name,
            version,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [roles.churchId, roles.id],
            set: { name: role.name, version, updatedAt: now },
          }),
      (q) =>
        q
          .delete(rolePermissions)
          .where(
            and(
              eq(rolePermissions.churchId, churchId),
              eq(rolePermissions.roleId, role.id)
            )
          ),
      ...chunk(role.permissions, ROWS_PER_INSERT).map(
        (permissions) => (q: SyncQuery) =>
          q
            .insert(rolePermissions)
            .values(
              permissions.map((permission) => ({
                churchId,
                roleId: role.id,
                permission,
              }))
            )
      )
    )
  }

  const currentUsers = await db.q
    .select()
    .from(users)
    .where(eq(users.churchId, churchId))
  const currentUserPermissions = await db.q
    .select()
    .from(userPermissions)
    .where(eq(userPermissions.churchId, churchId))
  let changedUsers = 0
  for (const user of access.users) {
    const current = currentUsers.find((u) => u.id === user.id)
    const granted = currentUserPermissions
      .filter((p) => p.userId === user.id)
      .map((p) => p.permission)
      .sort()
    const { permissions, ...fields } = user
    if (
      current &&
      current.name === user.name &&
      current.roleId === user.roleId &&
      current.isSuperAdmin === user.isSuperAdmin &&
      current.isActive === user.isActive &&
      JSON.stringify(granted) === JSON.stringify(permissions)
    ) {
      continue
    }
    changedUsers++
    const version = (current?.version ?? 0) + 1
    statements.push(
      (q) =>
        q
          .insert(users)
          .values({ churchId, ...fields, version, updatedAt: now })
          .onConflictDoUpdate({
            target: [users.churchId, users.id],
            set: { ...fields, version, updatedAt: now },
          }),
      (q) =>
        q
          .delete(userPermissions)
          .where(
            and(
              eq(userPermissions.churchId, churchId),
              eq(userPermissions.userId, user.id)
            )
          ),
      ...chunk(permissions, ROWS_PER_INSERT).map(
        (rows) => (q: SyncQuery) =>
          q
            .insert(userPermissions)
            .values(
              rows.map((permission) => ({
                churchId,
                userId: user.id,
                permission,
              }))
            )
      )
    )
  }

  const keptRoles = new Set(access.roles.map((r) => r.id))
  const keptUsers = new Set(access.users.map((u) => u.id))
  const removedRoles = currentRoles
    .map((r) => r.id)
    .filter((id) => !keptRoles.has(id))
  const removedUsers = currentUsers
    .map((u) => u.id)
    .filter((id) => !keptUsers.has(id))
  for (const ids of chunk(removedRoles, IDS_PER_DELETE)) {
    statements.push(
      (q) =>
        q
          .delete(rolePermissions)
          .where(
            and(
              eq(rolePermissions.churchId, churchId),
              inArray(rolePermissions.roleId, ids)
            )
          ),
      (q) =>
        q
          .delete(roles)
          .where(and(eq(roles.churchId, churchId), inArray(roles.id, ids)))
    )
  }
  for (const ids of chunk(removedUsers, IDS_PER_DELETE)) {
    statements.push(
      (q) =>
        q
          .delete(userPermissions)
          .where(
            and(
              eq(userPermissions.churchId, churchId),
              inArray(userPermissions.userId, ids)
            )
          ),
      (q) =>
        q
          .delete(users)
          .where(and(eq(users.churchId, churchId), inArray(users.id, ids)))
    )
  }

  await db.atomic((q) => statements.map((statement) => statement(q)))
  return {
    roles: changedRoles + removedRoles.length,
    users: changedUsers + removedUsers.length,
  }
}
