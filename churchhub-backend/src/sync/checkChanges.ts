import { ALL_PERMISSIONS } from './loadPermissions'
import { requiredPermission } from './requiredPermission'
import { SyncError } from './SyncError'
import type { ChangeInput } from './types'

/**
 * Refuses the whole write when any change is not allowed (403, with each
 * refused change and the permission it needs) or was based on an older
 * version than the church's (409, with the current versions): someone
 * changed the row first, and the client merges before sending it again.
 * `versions`: the church state's (negative: the row was deleted).
 */
export function checkChanges(
  changes: ChangeInput[],
  versions: Record<string, number>,
  granted: Set<string> | typeof ALL_PERMISSIONS
): void {
  const rejected = changes.flatMap((change) => {
    const current = versions[`${change.type}:${change.uuid}`] ?? 0
    const permission = requiredPermission(change.type, change.op, current > 0)
    return granted === ALL_PERMISSIONS || granted.has(permission)
      ? []
      : [{ type: change.type, uuid: change.uuid, permission }]
  })
  if (rejected.length > 0) {
    throw new SyncError(403, 'forbidden', 'Not allowed to make these changes', {
      rejected,
    })
  }

  const conflicts = changes.flatMap((change) => {
    const version = Math.abs(versions[`${change.type}:${change.uuid}`] ?? 0)
    return version === change.baseVersion
      ? []
      : [{ type: change.type, uuid: change.uuid, version }]
  })
  if (conflicts.length > 0) {
    throw new SyncError(409, 'conflict', 'Changed by someone else first', {
      conflicts,
    })
  }
}
