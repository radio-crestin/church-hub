/**
 * The order local changes are queued in: a counter on sync_state that only
 * grows, stamped on each queued change (`sync_pending.seq`). Bump it, then
 * stamp `PENDING_SEQ`, in the same statement or trigger.
 */
export const BUMP_PENDING_SEQ =
  'UPDATE sync_state SET pending_seq = pending_seq + 1 WHERE id = 1'

/** The number of the change being queued, once bumped. */
export const PENDING_SEQ = '(SELECT pending_seq FROM sync_state WHERE id = 1)'
