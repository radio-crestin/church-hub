import { type Access, applyAccessChange } from './applyAccessChange'
import { ALL_PERMISSIONS, loadPermissions } from './loadPermissions'
import { requiredPermission } from './requiredPermission'
import type { ChurchState } from './state/ChurchState'
import { SyncError } from './SyncError'
import type { ChangeInput, SyncCaller } from './types'

/** Who a change counts as made by: a phone's own user, or whom the server names. */
export function authorOf(caller: SyncCaller, change: ChangeInput): string | null {
  return caller.isServer ? change.author : caller.userId
}

/**
 * Refuses the whole write when any change is not allowed (403, with each
 * refused change and the permission it needs) or was based on an older
 * version than the church's (409, with the current versions): someone
 * changed the row first, and the client merges before sending it again.
 *
 * Each change is checked against its author's permissions as the changes
 * before it leave them: a user added earlier in the batch may make the
 * next change, and a user losing a permission can't use it later on.
 */
export function checkChanges(
  changes: ChangeInput[],
  state: ChurchState,
  caller: SyncCaller
): void {
  const access: Access = { roles: [...state.roles], users: [...state.users] }
  const rejected = changes.flatMap((change) => {
    const exists = (state.versions[`${change.type}:${change.uuid}`] ?? 0) > 0
    const permission = requiredPermission(change, exists, access)
    const granted = loadPermissions(access, {
      isServer: caller.isServer,
      userId: authorOf(caller, change),
    })
    const allowed =
      granted === ALL_PERMISSIONS ||
      (granted !== null && (permission === null || granted.has(permission)))
    if (allowed) {
      applyAccessChange(access, change)
      return []
    }
    return [
      {
        type: change.type,
        uuid: change.uuid,
        permission: permission ?? 'active_user',
      },
    ]
  })
  if (rejected.length > 0) {
    throw new SyncError(403, 'forbidden', 'Not allowed to make these changes', {
      rejected,
    })
  }

  const conflicts = changes.flatMap((change) => {
    const version = Math.abs(state.versions[`${change.type}:${change.uuid}`] ?? 0)
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
