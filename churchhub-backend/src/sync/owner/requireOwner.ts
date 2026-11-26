import type { ChurchState } from '../state/ChurchState'
import { SyncError } from '../SyncError'
import type { OwnerIdentity } from './OwnerIdentity'

/** 403 unless the signed-in account owns the church. */
export function requireOwner(state: ChurchState, owner: OwnerIdentity): void {
  if (state.owner?.googleSub !== owner.googleSub) {
    throw new SyncError(403, 'not_owner', 'You do not own this church')
  }
}
