import { getRawDatabase } from '../../db'

/**
 * The newest queued change's number (sync_state.pending_seq). Read before
 * the pending changes, it is what a sync clears up to once it has sent
 * them: a change queued after it stays queued, even within the same second.
 */
export function getLatestPendingSeq(): number {
  return (
    getRawDatabase()
      .query<{ seq: number }, []>(
        'SELECT pending_seq AS seq FROM sync_state WHERE id = 1',
      )
      .get()?.seq ?? 0
  )
}
