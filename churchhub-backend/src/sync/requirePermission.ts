import { ALL_PERMISSIONS, loadPermissions } from './loadPermissions'
import type { ChurchState } from './state/ChurchState'
import { SyncError } from './SyncError'
import type { SyncCaller } from './types'

/** Refuses the request (403) unless the caller holds `permission`. */
export function requirePermission(
  state: ChurchState,
  caller: SyncCaller,
  permission: string
): void {
  const granted = loadPermissions(state, caller)
  if (granted === ALL_PERMISSIONS || granted.has(permission)) return
  throw new SyncError(403, 'forbidden', `Requires ${permission}`, {
    permission,
  })
}
