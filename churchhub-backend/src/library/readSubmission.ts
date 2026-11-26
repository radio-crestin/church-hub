import type { Bucket } from '../sync/createBucket'
import { SyncError } from '../sync/SyncError'
import { libraryKeys } from './libraryKeys'
import type { Submission } from './types'

/** A pending submission; 404 when unknown or already decided. */
export async function readSubmission(
  states: Bucket,
  id: string
): Promise<Submission> {
  const found = /^[A-Za-z0-9_-]{1,64}$/.test(id)
    ? await states.get(libraryKeys.pending(id))
    : null
  if (!found) {
    throw new SyncError(404, 'not_found', 'No such pending submission')
  }
  return JSON.parse(new TextDecoder().decode(found.bytes)) as Submission
}
