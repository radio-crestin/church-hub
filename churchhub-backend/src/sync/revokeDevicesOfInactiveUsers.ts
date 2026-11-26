import type { ChurchState } from './state/ChurchState'

/**
 * Revokes (in place) every device whose user is deactivated or no longer in
 * the church: they must be added again to rejoin, even once the user is
 * active again. The church server's own token is never one of them.
 * Returns how many were revoked.
 */
export function revokeDevicesOfInactiveUsers(
  church: ChurchState,
  now: number
): number {
  const active = new Set(
    church.users.filter((user) => user.isActive).map((user) => user.id)
  )
  let revoked = 0
  for (const device of church.devices) {
    if (device.isServer || device.revokedAt !== null) continue
    if (device.userId !== null && active.has(device.userId)) continue
    device.revokedAt = now
    revoked++
  }
  return revoked
}
