import type { BatchItem } from 'drizzle-orm/batch'
import { and, eq, inArray } from 'drizzle-orm'
import type { SyncDb } from './getSyncDb'
import type { Access } from './parseAccess'
import { rolePermissions, roles, userPermissions, users } from './schema'

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
  const now = Math.floor(Date.now() / 1000)
  const statements: BatchItem<'sqlite'>[] = []

  const currentRoles = await db.query.roles.findMany({
    where: eq(roles.churchId, churchId),
  })
  const currentRolePermissions = await db
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
      db
        .insert(roles)
        .values({ churchId, id: role.id, name: role.name, version, updatedAt: now })
        .onConflictDoUpdate({
          target: [roles.churchId, roles.id],
          set: { name: role.name, version, updatedAt: now },
        }),
      db
        .delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.churchId, churchId),
            eq(rolePermissions.roleId, role.id)
          )
        ),
      ...chunk(role.permissions, ROWS_PER_INSERT).map((permissions) =>
        db
          .insert(rolePermissions)
          .values(permissions.map((permission) => ({ churchId, roleId: role.id, permission })))
      )
    )
  }

  const currentUsers = await db.query.users.findMany({
    where: eq(users.churchId, churchId),
  })
  const currentUserPermissions = await db
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
      db
        .insert(users)
        .values({ churchId, ...fields, version, updatedAt: now })
        .onConflictDoUpdate({
          target: [users.churchId, users.id],
          set: { ...fields, version, updatedAt: now },
        }),
      db
        .delete(userPermissions)
        .where(
          and(
            eq(userPermissions.churchId, churchId),
            eq(userPermissions.userId, user.id)
          )
        ),
      ...chunk(permissions, ROWS_PER_INSERT).map((rows) =>
        db
          .insert(userPermissions)
          .values(rows.map((permission) => ({ churchId, userId: user.id, permission })))
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
      db
        .delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.churchId, churchId),
            inArray(rolePermissions.roleId, ids)
          )
        ),
      db
        .delete(roles)
        .where(and(eq(roles.churchId, churchId), inArray(roles.id, ids)))
    )
  }
  for (const ids of chunk(removedUsers, IDS_PER_DELETE)) {
    statements.push(
      db
        .delete(userPermissions)
        .where(
          and(
            eq(userPermissions.churchId, churchId),
            inArray(userPermissions.userId, ids)
          )
        ),
      db
        .delete(users)
        .where(and(eq(users.churchId, churchId), inArray(users.id, ids)))
    )
  }

  if (statements.length > 0) {
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  }
  return {
    roles: changedRoles + removedRoles.length,
    users: changedUsers + removedUsers.length,
  }
}
