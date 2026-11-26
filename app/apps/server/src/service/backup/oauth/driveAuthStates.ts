import { randomBytes } from 'node:crypto'

/** A connect flow left unfinished this long is forgotten. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000

/** Drive connect flows this server started, by state, with their start time. */
const pending = new Map<string, number>()

/** A new connect flow's state: the callback accepts only states it issued. */
export function issueDriveAuthState(): string {
  const now = Date.now()
  for (const [state, startedAt] of pending) {
    if (now - startedAt > STATE_MAX_AGE_MS) pending.delete(state)
  }
  const state = randomBytes(24).toString('base64url')
  pending.set(state, now)
  return state
}

/** Whether the state belongs to a flow this server started; it is used up. */
export function consumeDriveAuthState(state: string | null): boolean {
  if (!state) return false
  const startedAt = pending.get(state)
  pending.delete(state)
  return startedAt !== undefined && Date.now() - startedAt <= STATE_MAX_AGE_MS
}
