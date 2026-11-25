import type { EntityVersion } from './loadEntityVersions'
import { ALL_PERMISSIONS } from './loadPermissions'
import { requiredPermission } from './requiredPermission'
import { SyncError } from './SyncError'
import type { ChangeInput } from './types'

/**
 * Refuses the whole write when any change is not allowed (403, with each
 * refused change and the permission it needs) or was based on an older
 * version than the central one (409, with the current versions): someone
 * changed the row first, and the client merges before sending it again.
 */
export function checkChanges(
  changes: ChangeInput[],
  versions: Map<string, EntityVersion>,
  granted: Set<string> | typeof ALL_PERMISSIONS
): void {
  const rejected = changes.flatMap((change) => {
    const current = versions.get(`${change.type}:${change.uuid}`)
    const permission = requiredPermission(
      change.type,
      change.op,
      current !== undefined && !current.deleted
    )
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
    const version =
      versions.get(`${change.type}:${change.uuid}`)?.version ?? 0
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
