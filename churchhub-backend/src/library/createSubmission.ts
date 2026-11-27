import type { Bucket } from '../sync/createBucket'
import { randomId } from '../sync/randomId'
import { libraryKeys } from './libraryKeys'
import type { SubmissionInput } from './parseSubmission'
import type { Submission } from './types'

/** Writes at a time. */
const CONCURRENCY = 8

/**
 * Keeps a church's songs for the curators, privately: one submission per
 * song, so each is decided on its own, sharing the batch they came in.
 */
export async function createSubmission(
  states: Bucket,
  input: SubmissionInput
): Promise<{ batchId: string; submissions: Submission[] }> {
  const batchId = randomId(12)
  const submittedAt = Date.now()
  const submissions: Submission[] = input.songs.map((song) => ({
    ...song,
    id: randomId(16),
    submittedAt,
    churchName: input.churchName,
    note: input.note,
    batchId,
    batchSize: input.songs.length,
  }))
  const queue = [...submissions]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await states.put(
          libraryKeys.pending(next.id),
          new TextEncoder().encode(JSON.stringify(next)),
          { contentType: 'application/json', cacheControl: 'no-store' }
        )
      }
    })
  )
  return { batchId, submissions }
}
