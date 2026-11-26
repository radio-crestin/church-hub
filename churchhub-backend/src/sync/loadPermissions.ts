import type { Access } from './applyAccessChange'

/** Everything is allowed: the church server itself, or a super admin. */
export const ALL_PERMISSIONS = 'all'

/**
 * What a user may do: the church server acting for nobody and super admins
 * may do anything; any other active user has their role's permissions plus
 * their own; an unknown or deactivated user nothing at all (null).
 */
export function loadPermissions(
  access: Access,
  who: { isServer: boolean; userId: string | null }
): Set<string> | typeof ALL_PERMISSIONS | null {
  if (who.isServer && !who.userId) return ALL_PERMISSIONS
  const user = access.users.find((candidate) => candidate.id === who.userId)
  if (!user?.isActive) return null
  if (user.isSuperAdmin) return ALL_PERMISSIONS

  const role = access.roles.find((candidate) => candidate.id === user.roleId)
  return new Set([...user.permissions, ...(role?.permissions ?? [])])
}
