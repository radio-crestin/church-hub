import { SyncError } from '../sync/SyncError'
import type { DecisionInput } from './decideSubmission'

/** A curator's decision from the request body; 400 otherwise. */
export function parseDecision(body: unknown): DecisionInput {
  const input = (body ?? {}) as Record<string, unknown>
  if (input.decision === 'rejected') {
    const reason =
      typeof input.reason === 'string' && input.reason.trim()
        ? input.reason.trim().slice(0, 1000)
        : null
    return { decision: 'rejected', reason }
  }
  if (input.decision !== 'approved' && input.decision !== 'merged') {
    throw new SyncError(
      400,
      'invalid_request',
      'decision must be approved, merged or rejected'
    )
  }
  if (typeof input.librarySongId !== 'string' || !input.librarySongId) {
    throw new SyncError(400, 'invalid_request', 'librarySongId is required')
  }
  return { decision: input.decision, librarySongId: input.librarySongId }
}
