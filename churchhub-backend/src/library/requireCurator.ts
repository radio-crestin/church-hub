import type { Context } from 'hono'
import type { OwnerIdentity } from '../sync/owner/OwnerIdentity'
import { ticketFromHeader, verifyOwnerTicket } from '../sync/owner/ownerTicket'
import type { SyncStore } from '../sync/state/ChurchState'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'
import { isCurator } from './isCurator'

/** The signed-in curator; 401 without a valid ticket, 403 when not a curator. */
export async function requireCurator(
  c: Context<{ Bindings: Bindings }>,
  store: SyncStore
): Promise<OwnerIdentity> {
  const account = await verifyOwnerTicket(
    ticketFromHeader(c.req.header('Authorization')),
    store.secret
  )
  if (!isCurator(c.env.LIBRARY_CURATORS, account)) {
    throw new SyncError(403, 'not_curator', 'Not a library curator')
  }
  return account
}
