import type { Context } from 'hono'
import { authenticate } from '../sync/authenticate'
import { checkInstallation } from '../sync/checkInstallation'
import { readInstallation } from '../sync/readInstallation'
import { requirePermission } from '../sync/requirePermission'
import type { SyncStore } from '../sync/state/ChurchState'
import { readChurch } from '../sync/state/readChurch'
import type { Bindings } from '../types'
import { churchOfSource } from './churchOfSource'
import { requireManagedWriter } from './requireManagedWriter'

/** Sharing a church's songs is a change to them: the app's songs.edit. */
export const SHARE_PERMISSION = 'songs.edit'

/**
 * Who may write a library: a church's own (`<churchId>-…`,
 * churchOfSource), that church's PC or a device whose user has songs.edit;
 * any other (the ones Church Hub manages: the curated library, Resurse
 * Creștine…), a curator or the build that publishes them.
 */
export async function authorizeLibraryWrite(
  c: Context<{ Bindings: Bindings }>,
  store: SyncStore,
  sourceId: string
): Promise<void> {
  const churchId = churchOfSource(sourceId)
  if (!churchId) {
    await requireManagedWriter(c, store)
    return
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
