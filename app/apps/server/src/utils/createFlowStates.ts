import { randomBytes } from 'node:crypto'

/** A flow left unfinished this long is forgotten. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Single-use states for sign-in flows that come back through the browser:
 * `issue` gives a flow its state, `consume` accepts it back once, within
 * ten minutes. A state this server never issued is refused, so a link built
 * elsewhere can't connect an account of someone else's choosing.
 */
export function createFlowStates() {
  const pending = new Map<string, number>()

  function issue(): string {
    const now = Date.now()
    for (const [state, startedAt] of pending) {
      if (now - startedAt > STATE_MAX_AGE_MS) pending.delete(state)
    }
    const state = randomBytes(24).toString('base64url')
    pending.set(state, now)
    return state
  }

  function consume(state: unknown): boolean {
    if (typeof state !== 'string' || !state) return false
    const startedAt = pending.get(state)
    pending.delete(state)
    return startedAt !== undefined && Date.now() - startedAt <= STATE_MAX_AGE_MS
  }

  return { issue, consume }
}
