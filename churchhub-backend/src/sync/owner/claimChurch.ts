import type { SyncStore } from '../state/ChurchState'
import { updateChurch } from '../state/updateChurch'
import { SyncError } from '../SyncError'
import { addOwnerMarker } from './ownerIndex'
import type { OwnerIdentity } from './OwnerIdentity'

/**
 * Makes a guest church owned by the signed-in account: nothing moves, the
 * state just records the owner. Claiming again with the same account is a
 * no-op; another account's church answers 409 `already_owned`.
 */
export async function claimChurch(
  store: SyncStore,
  churchId: string,
  owner: OwnerIdentity
): Promise<{ email: string }> {
  await updateChurch(store, churchId, async (church) => {
    if (church.owner) {
      if (church.owner.googleSub === owner.googleSub) return null
      throw new SyncError(409, 'already_owned', 'This church has an owner')
    }
    church.owner = {
      googleSub: owner.googleSub,
      email: owner.email,
      claimedAt: Math.floor(Date.now() / 1000),
    }
    return { next: church, result: owner.email }
  })
  await addOwnerMarker(store, owner.email, churchId)
  return { email: owner.email }
}
