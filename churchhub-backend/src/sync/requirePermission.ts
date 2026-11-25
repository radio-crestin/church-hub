import type { SyncDb } from './db/SyncDb'
import { ALL_PERMISSIONS, loadPermissions } from './loadPermissions'
import { SyncError } from './SyncError'
import type { SyncCaller } from './types'

/** Refuses the request (403) unless the caller holds `permission`. */
export async function requirePermission(
  db: SyncDb,
  caller: SyncCaller,
  permission: string
): Promise<void> {
  const granted = await loadPermissions(db, caller)
  if (granted === ALL_PERMISSIONS || granted.has(permission)) return
  throw new SyncError(403, 'forbidden', `Requires ${permission}`, {
    permission,
  })
}
