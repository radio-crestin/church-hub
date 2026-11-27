import type { Context } from 'hono'
import { authenticate } from '../sync/authenticate'
import { checkInstallation } from '../sync/checkInstallation'
import { readInstallation } from '../sync/readInstallation'
import { requirePermission } from '../sync/requirePermission'
import type { SyncStore } from '../sync/state/ChurchState'
import { readChurch } from '../sync/state/readChurch'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'
import { churchOfSource } from './churchOfSource'
import { requireCurator } from './requireCurator'
import { CURATED_SOURCE_ID } from './types'

/** Sharing a church's songs is a change to them: the app's songs.edit. */
export const SHARE_PERMISSION = 'songs.edit'

/**
 * Who may write a library: the curated one, a curator; a church's own
 * (`<churchId>-…`, churchOfSource), that church's PC or a device whose
 * user has songs.edit. Anything else is refused.
 */
export async function authorizeLibraryWrite(
  c: Context<{ Bindings: Bindings }>,
  store: SyncStore,
  sourceId: string
): Promise<void> {
  if (sourceId === CURATED_SOURCE_ID) {
    await requireCurator(c, store)
    return
  }
  const churchId = churchOfSource(sourceId)
  if (!churchId) {
    throw new SyncError(403, 'forbidden', 'Not allowed to publish this library')
  }
  const found = await readChurch(store, churchId)
  const who = await authenticate(store, found, c.req.header('Authorization'))
  // authenticate refuses an unknown church, so it was found.
  const church = await checkInstallation(
    store,
    found as NonNullable<typeof found>,
    who,
    readInstallation((name) => c.req.header(name)),
    false
  )
  requirePermission(church.state, who, SHARE_PERMISSION)
}
