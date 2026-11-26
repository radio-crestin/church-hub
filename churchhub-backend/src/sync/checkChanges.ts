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
 * Whether `access` lets the change's author make it, and if not, what they
 * lack: a permission, or being an active user at all.
 */
function check(
  change: ChangeInput,
  exists: boolean,
  access: Access,
  author: { isServer: boolean; userId: string | null }
): { allowed: boolean; lacks: string } {
  const needs = requiredPermission(change, exists, access)
  const granted = loadPermissions(access, author)
  if (granted === null) return { allowed: false, lacks: 'active_user' }
  const allowed =
    granted === ALL_PERMISSIONS ||
    needs === null ||
    needs.some((permission) => granted.has(permission))
  return { allowed, lacks: needs?.[0] ?? 'active_user' }
}

/**
 * Refuses the whole write when any change is not allowed (403, with each
 * refused change and the permission it needs) or was based on an older
 * version than the church's (409, with the current versions): someone
 * changed the row first, and the client merges before sending it again.
 *
 * A change is allowed when its author may make it either as the church
 * stood before the write, or as the changes before it in the batch leave
 * it: a user added earlier in the batch may make the next change, and a
 * user deactivated later in it keeps the edits they made before.
 */
export function checkChanges(
  changes: ChangeInput[],
  state: ChurchState,
  caller: SyncCaller
): void {
  const before: Access = { roles: state.roles, users: state.users }
  const access: Access = { roles: [...state.roles], users: [...state.users] }
  const rejected = changes.flatMap((change) => {
    const exists = (state.versions[`${change.type}:${change.uuid}`] ?? 0) > 0
    const author = { isServer: caller.isServer, userId: authorOf(caller, change) }
    const now = check(change, exists, access, author)
    if (now.allowed || check(change, exists, before, author).allowed) {
      applyAccessChange(access, change)
      return []
    }
    return [{ type: change.type, uuid: change.uuid, permission: now.lacks }]
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
