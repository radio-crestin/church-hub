import type { Bucket } from '../sync/createBucket'
import { libraryKeys } from './libraryKeys'
import { readSubmission } from './readSubmission'
import type { Submission } from './types'

/** Every submission waiting for a curator, oldest first. */
export async function listSubmissions(states: Bucket): Promise<Submission[]> {
  const keys = await states.list(libraryKeys.pendingPrefix)
  const ids = keys.map((key) =>
    key.slice(libraryKeys.pendingPrefix.length).replace(/\.json$/, '')
  )
  const submissions = await Promise.all(
    ids.map((id) => readSubmission(states, id).catch(() => null))
  )
  return submissions
    .filter((submission): submission is Submission => submission !== null)
    .sort((a, b) => a.submittedAt - b.submittedAt)
}
