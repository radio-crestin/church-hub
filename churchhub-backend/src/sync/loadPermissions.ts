import type { ChurchState } from './state/ChurchState'
import type { SyncCaller } from './types'

/** Everything is allowed: the church server itself, or a super admin. */
export const ALL_PERMISSIONS = 'all'

/**
 * What the caller may do: the church server acting for nobody and super
 * admins may do anything; any other user has their role's permissions plus
 * their own; an unknown or deactivated user has none.
 */
export function loadPermissions(
  state: ChurchState,
  caller: SyncCaller
): Set<string> | typeof ALL_PERMISSIONS {
  if (caller.isServer && !caller.userId) return ALL_PERMISSIONS
  const user = state.users.find((candidate) => candidate.id === caller.userId)
  if (!user?.isActive) return new Set()
  if (user.isSuperAdmin) return ALL_PERMISSIONS

  const role = state.roles.find((candidate) => candidate.id === user.roleId)
  return new Set([...user.permissions, ...(role?.permissions ?? [])])
}
