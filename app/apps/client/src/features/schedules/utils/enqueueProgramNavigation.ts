/** The program step running or waiting last; every window has one queue. */
let queue: Promise<unknown> = Promise.resolve()

/**
 * Runs a program step once every step asked for before it has landed.
 *
 * A step is absolute: it projects "the step after the one on screen". Read when
 * the key is pressed, that position lags behind every press still on its way,
 * so presses made in quick succession (or a held key) all projected the same
 * step, and a late answer could put the cursor back where it had been. Waiting
 * its turn and reading the position then applies each press to the step the
 * previous one put up.
 */
export function enqueueProgramNavigation(
  step: () => Promise<void>,
): Promise<void> {
  const run = queue.then(step)
  // A failed step still reaches its caller; the queue itself moves on.
  queue = run.catch(() => undefined)
  return run
}
