import type { Bucket } from '../sync/createBucket'
import { randomId } from '../sync/randomId'
import { libraryKeys } from './libraryKeys'
import type { SubmissionInput } from './parseSubmission'
import type { Submission } from './types'

/** Keeps a church's song for the curators, privately. */
export async function createSubmission(
  states: Bucket,
  input: SubmissionInput
): Promise<Submission> {
  const submission: Submission = {
    id: randomId(16),
    submittedAt: Date.now(),
    ...input,
  }
  await states.put(
    libraryKeys.pending(submission.id),
    new TextEncoder().encode(JSON.stringify(submission)),
    { contentType: 'application/json', cacheControl: 'no-store' }
  )
  return submission
}
