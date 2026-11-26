import { requireOwnerSession } from '../sync/cloud/ownerSession'

/** The signed-in account's ticket; throws owner_sign_in_required without one. */
export function requireCuratorTicket(): string {
  return requireOwnerSession().ticket
}
