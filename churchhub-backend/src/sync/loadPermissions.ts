import { and, eq } from 'drizzle-orm'
import type { SyncDb } from './getSyncDb'
import { rolePermissions, userPermissions, users } from './schema'
import type { SyncCaller } from './types'

/** Everything is allowed: the church server itself, or a super admin. */
export const ALL_PERMISSIONS = 'all'

/**
 * What the caller may do: the church server acting for nobody and super
 * admins may do anything; any other user has their role's permissions plus
 * their own; an unknown or deactivated user has none.
 */
export async function loadPermissions(
  db: SyncDb,
  caller: SyncCaller
): Promise<Set<string> | typeof ALL_PERMISSIONS> {
  if (caller.isServer && !caller.userId) return ALL_PERMISSIONS
  if (!caller.userId) return new Set()

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.churchId, caller.churchId), eq(users.id, caller.userId)))
    .limit(1)
  if (!user?.isActive) return new Set()
  if (user.isSuperAdmin) return ALL_PERMISSIONS

  const own = await db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.churchId, caller.churchId),
        eq(userPermissions.userId, user.id)
      )
    )
  const fromRole = user.roleId
    ? await db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.churchId, caller.churchId),
            eq(rolePermissions.roleId, user.roleId)
          )
        )
    : []
  return new Set([...own, ...fromRole].map((row) => row.permission))
}
