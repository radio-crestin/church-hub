import type { SyncStore } from '../state/ChurchState'
import { readChurch } from '../state/readChurch'
import { listOwnerMarkers, removeOwnerMarker } from './ownerIndex'
import type { OwnerIdentity } from './OwnerIdentity'

export interface OwnedChurch {
  churchId: string
  /** The church server's name (its PC's hostname). */
  name: string
  /** `pending`: offered to this account by a transfer, not accepted yet. */
  role: 'owner' | 'pending'
  createdAt: number
  updatedAt: number
  /** Unix seconds the church server last called, when known. */
  serverLastSeenAt: number | null
  /** Phones and other devices with a live token. */
  deviceCount: number
}

/**
 * The church servers the account owns or is offered. A marker whose church
 * no longer names this account is stale (the church was transferred) and
 * is removed on the way.
 */
export async function listOwnedChurches(
  store: SyncStore,
  owner: OwnerIdentity
): Promise<OwnedChurch[]> {
  const churches: OwnedChurch[] = []
  for (const churchId of await listOwnerMarkers(store, owner.email)) {
    const church = await readChurch(store, churchId)
    const state = church?.state
    const role =
      state?.owner?.googleSub === owner.googleSub
        ? 'owner'
        : state?.pendingOwnerEmail === owner.email
          ? 'pending'
          : null
    if (!state || !role) {
      await removeOwnerMarker(store, owner.email, churchId)
      continue
    }
    const live = state.devices.filter((device) => device.revokedAt === null)
    const server = live.find((device) => device.isServer)
    churches.push({
      churchId,
      name: server?.name ?? 'Church server',
      role,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      serverLastSeenAt: server?.lastSeenAt ?? null,
      deviceCount: live.filter((device) => !device.isServer).length,
    })
  }
  return churches.sort((a, b) => b.updatedAt - a.updatedAt)
}
