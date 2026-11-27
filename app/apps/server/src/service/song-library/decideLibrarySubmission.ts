import { randomUUID } from 'node:crypto'

import { fetchSubmissions } from './fetchSubmissions'
import { libraryRequest } from './libraryRequest'
import { publishCuratedSong } from './publishCuratedSong'
import { requireCuratorTicket } from './requireCuratorTicket'
import { toLibrarySongInput } from './toLibrarySongInput'
import type { CuratorDecision } from './types'

/**
 * A curator's decision on a submission. Approved: published as a new
 * library song. Merged: published as the new version of the chosen song.
 * Rejected: nothing published. The service then records it.
 */
export async function decideLibrarySubmission(
  submissionId: string,
  input: CuratorDecision,
): Promise<{ librarySongId: string | null }> {
  const ticket = requireCuratorTicket()
  if (input.decision === 'rejected') {
    await libraryRequest('POST', `/submissions/${submissionId}/decision`, {
      ticket,
      body: input,
    })
    return { librarySongId: null }
  }
  const submission = (await fetchSubmissions(ticket)).find(
    (candidate) => candidate.id === submissionId,
  )
  if (!submission) throw new Error('submission_not_found')
  const librarySongId =
    input.decision === 'merged' ? input.librarySongId : randomUUID()
  await publishCuratedSong(
    ticket,
    toLibrarySongInput(librarySongId, submission.xml),
    input.decision === 'merged',
  )
  await libraryRequest('POST', `/submissions/${submissionId}/decision`, {
    ticket,
    body: { decision: input.decision, librarySongId },
  })
  return { librarySongId }
}
