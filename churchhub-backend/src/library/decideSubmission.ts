import type { SyncStore } from '../sync/state/ChurchState'
import { SyncError } from '../sync/SyncError'
import { libraryKeys } from './libraryKeys'
import { readManifest } from './readManifest'
import { readSubmission } from './readSubmission'
import {
  CURATED_SOURCE_ID,
  type Decision,
  type DecidedSubmission,
} from './types'

export type DecisionInput =
  | { decision: 'approved' | 'merged'; librarySongId: string }
  | { decision: 'rejected'; reason: string | null }

/**
 * Records a curator's decision on a pending submission. Approved (a new
 * library song) and merged (the new version of an existing one) come after
 * the curator's PC published the library with the song in it, which is
 * checked; rejected publishes nothing. The submission then moves to the
 * decided record.
 */
export async function decideSubmission(
  store: SyncStore,
  id: string,
  input: DecisionInput,
  curatorEmail: string
): Promise<DecidedSubmission> {
  const submission = await readSubmission(store.states, id)
  if (input.decision !== 'rejected') {
    const library = await readManifest(store.bucket, CURATED_SOURCE_ID)
    if (!library?.manifest.songs.some((song) => song.id === input.librarySongId)) {
      throw new SyncError(
        409,
        'not_published',
        'Publish the song in the library first'
      )
    }
  }
  const decided: DecidedSubmission = {
    ...submission,
    decision: input.decision satisfies Decision,
    decidedAt: Date.now(),
    decidedBy: curatorEmail,
    librarySongId: input.decision === 'rejected' ? null : input.librarySongId,
    reason: input.decision === 'rejected' ? input.reason : null,
  }
  await store.states.put(
    libraryKeys.decided(id),
    new TextEncoder().encode(JSON.stringify(decided)),
    { contentType: 'application/json', cacheControl: 'no-store' }
  )
  await store.states.delete(libraryKeys.pending(id))
  return decided
}
