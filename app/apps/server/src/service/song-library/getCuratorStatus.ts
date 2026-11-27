import { libraryRequest } from './libraryRequest'
import type { CuratorStatus } from './types'
import { getOwnerSession } from '../sync/cloud/ownerSession'

/** The Google account signed in on this PC, and whether it curates the library. */
export async function getCuratorStatus(): Promise<CuratorStatus> {
  const session = getOwnerSession()
  if (!session) return { signedIn: false, email: null, curator: false }
  const { curator } = await libraryRequest<{ curator: boolean }>(
    'GET',
    '/curator',
    { ticket: session.ticket },
  )
  return { signedIn: true, email: session.email, curator }
}
