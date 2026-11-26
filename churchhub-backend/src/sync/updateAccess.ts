import type { Access } from './parseAccess'
import type { SyncStore } from './state/ChurchState'
import { updateChurch } from './state/updateChurch'

const BOOKKEEPING = new Set(['permissions', 'version', 'updatedAt'])

/** A row's fields that count as a change, in a stable order. */
function signature(row: { permissions: string[] }): string {
  const fields = Object.entries(row)
    .filter(([name]) => !BOOKKEEPING.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([fields, [...row.permissions].sort()])
}

/**
 * Replaces the church's roles and users with the PC's, the authority the
 * service checks every write against. A row's version goes up only when it
 * really changed; roles and users the PC no longer has are removed.
 * Returns how many rows changed.
 */
export async function updateAccess(
  store: SyncStore,
  churchId: string,
  access: Access
): Promise<{ roles: number; users: number }> {
  const { result } = await updateChurch(store, churchId, async (church) => {
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

    if (changed.roles === 0 && changed.users === 0) return null
    church.roles = roles
    church.users = users
    church.updatedAt = now
    return { next: church, result: changed }
  })
  return result ?? { roles: 0, users: 0 }
}
