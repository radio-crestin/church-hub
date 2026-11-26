import type { SyncStore } from '../state/ChurchState'
import { updateChurch } from '../state/updateChurch'
import { SyncError } from '../SyncError'
import { removeOwnerMarker } from './ownerIndex'
import type { OwnerIdentity } from './OwnerIdentity'

/**
 * The account a church was offered to accepts it and becomes its owner;
 * the previous owner no longer finds it among their churches.
 */
export async function acceptTransfer(
  store: SyncStore,
  churchId: string,
  owner: OwnerIdentity
): Promise<{ email: string }> {
  let previousEmail = null as string | null
  await updateChurch(store, churchId, async (church) => {
    if (!church.pendingOwnerEmail || church.pendingOwnerEmail !== owner.email) {
      throw new SyncError(403, 'not_offered', 'This church was not offered to you')
    }
    previousEmail = church.owner?.email ?? null
    const now = Math.floor(Date.now() / 1000)
    church.owner = {
      googleSub: owner.googleSub,
      email: owner.email,
      claimedAt: now,
    }
    church.pendingOwnerEmail = null
    church.updatedAt = now
    return { next: church, result: owner.email }
  })
  if (previousEmail && previousEmail !== owner.email) {
    await removeOwnerMarker(store, previousEmail, churchId)
  }
  return { email: owner.email }
}
