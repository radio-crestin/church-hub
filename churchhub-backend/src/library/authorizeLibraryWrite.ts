import type { Context } from 'hono'
import type { SyncStore } from '../sync/state/ChurchState'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'
import { requireCurator } from './requireCurator'
import { CURATED_SOURCE_ID } from './types'

/**
 * Who may write a library: the curated one, a curator; a church's own
 * (`<churchId>-…`), that church's device or PC token with songs.edit
 * (T-176). Anything else is refused.
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
  throw new SyncError(403, 'forbidden', 'Not allowed to publish this library')
}
