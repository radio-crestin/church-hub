import { finishPathMove } from './finishPathMove'
import { movePathSecret, type PathMove } from './movePathSecret'
import type { Access } from './parseAccess'
import { revokeDevicesOfInactiveUsers } from './revokeDevicesOfInactiveUsers'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { updateChurch } from './state/updateChurch'

const BOOKKEEPING = new Set(['permissions', 'version', 'updatedAt'])

/** A row's fields that count as a change, in a stable order. */
function signature(row: { permissions: string[] }): string {
  const fields = Object.entries(row)
    .filter(([name]) => !BOOKKEEPING.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([fields, [...row.permissions].sort()])
}

export interface AccessUpdate {
  /** How many roles and users changed. */
  changed: { roles: number; users: number }
  /** Devices revoked because their user was deactivated or removed. */
  revokedDevices: number
  state: ChurchState
}

/**
 * Replaces the church's roles and users with the PC's, the authority the
 * service checks every write against. A row's version goes up only when it
 * really changed; roles and users the PC no longer has are removed. Once
 * the PC asked for it (revokeDevicesWithUser), the devices of a user it
 * deactivated or removed are revoked and the path secret moves, in the
 * same state write, so none of them reads or writes again.
 */
export async function updateAccess(
  store: SyncStore,
  churchId: string,
  access: Access
): Promise<AccessUpdate> {
  let move: PathMove | null = null
  const { state, etag, result } = await updateChurch(
    store,
    churchId,
    async (church) => {
      move = null
      const now = Math.floor(Date.now() / 1000)
      const changed = { roles: 0, users: 0 }

      const roles = access.roles.map((role) => {
        const current = church.roles.find((r) => r.id === role.id)
        if (current && signature(current) === signature(role)) return current
        changed.roles++
        return { ...role, version: (current?.version ?? 0) + 1, updatedAt: now }
      })
      const users = access.users.map((user) => {
        const current = church.users.find((u) => u.id === user.id)
        if (current && signature(current) === signature(user)) return current
        changed.users++
        return { ...user, version: (current?.version ?? 0) + 1, updatedAt: now }
      })
      changed.roles += church.roles.filter(
        (r) => !roles.some((kept) => kept.id === r.id)
      ).length
      changed.users += church.users.filter(
        (u) => !users.some((kept) => kept.id === u.id)
      ).length

      const optingIn =
        access.revokeDevicesWithUser && !church.revokeDevicesWithUser
      church.roles = roles
      church.users = users
      if (optingIn) church.revokeDevicesWithUser = true
      const revokedDevices = church.revokeDevicesWithUser
        ? revokeDevicesOfInactiveUsers(church, now)
        : 0

      if (changed.roles + changed.users + revokedDevices === 0 && !optingIn) {
        return null
      }
      church.updatedAt = now
      if (revokedDevices > 0) move = await movePathSecret(store.bucket, church)
      return {
        next: church,
        result: { changed, revokedDevices },
        undo: move?.undo,
      }
    }
  )
  const moved = move as PathMove | null
  if (moved) await finishPathMove(store, state, etag, moved.oldPrefix)
  return {
    ...(result ?? { changed: { roles: 0, users: 0 }, revokedDevices: 0 }),
    state,
  }
}
