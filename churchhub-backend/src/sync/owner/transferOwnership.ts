import type { SyncStore } from '../state/ChurchState'
import { updateChurch } from '../state/updateChurch'
import { SyncError } from '../SyncError'
import { addOwnerMarker, removeOwnerMarker } from './ownerIndex'
import type { OwnerIdentity } from './OwnerIdentity'
import { requireOwner } from './requireOwner'

/**
 * The owner offers the church to another Google account by its email; it
 * stays theirs until that account signs in and accepts (acceptTransfer).
 * A new offer replaces the previous one.
 */
export async function transferOwnership(
  store: SyncStore,
  churchId: string,
  owner: OwnerIdentity,
  email: string
): Promise<{ pendingOwnerEmail: string }> {
  let previous = null as string | null
  await updateChurch(store, churchId, async (church) => {
    requireOwner(church, owner)
    if (email === church.owner?.email) {
      throw new SyncError(400, 'invalid_request', 'You already own it')
    }
    previous = church.pendingOwnerEmail ?? null
    church.pendingOwnerEmail = email
    church.updatedAt = Math.floor(Date.now() / 1000)
    return { next: church, result: email }
  })
  if (previous && previous !== email) {
    await removeOwnerMarker(store, previous, churchId)
  }
  await addOwnerMarker(store, email, churchId)
  return { pendingOwnerEmail: email }
}
