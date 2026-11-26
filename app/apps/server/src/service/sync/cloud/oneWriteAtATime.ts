let previous: Promise<unknown> = Promise.resolve()

/**
 * Sends `write` to the sync service once this server's earlier writes have
 * been answered. The service saves a church's state only if nobody wrote in
 * between, and otherwise starts the write over, so two of this server's own
 * writes in flight at once make one of them start over. A path move (a
 * device revoked) rewrites the whole library, and kept losing that race to
 * the chunks of a first upload until the upload ended.
 */
export function oneWriteAtATime<T>(write: () => Promise<T>): Promise<T> {
  const turn = previous.then(write)
  // The caller gets the failure through `turn`; the next write still goes.
  previous = turn.catch(() => undefined)
  return turn
}
