import { randomBytes } from 'node:crypto'

/** The two actions that can't be undone from this PC need a fresh confirmation. */
export type ConfirmedAction = 'restore' | 'delete-account'

/** A confirmation is used once, within this long. */
const CONFIRMATION_TTL_MS = 2 * 60 * 1000

interface Confirmation {
  action: ConfirmedAction
  target: string
  expiresAt: number
}

const issued = new Map<string, Confirmation>()

/**
 * A single-use token for one action on one target (a backup id, or the
 * account), handed to the UI when the operator confirms in its dialog.
 */
export function issueConfirmation(action: ConfirmedAction, target: string) {
  const now = Date.now()
  for (const [token, entry] of issued) {
    if (entry.expiresAt <= now) issued.delete(token)
  }
  const token = randomBytes(24).toString('base64url')
  issued.set(token, { action, target, expiresAt: now + CONFIRMATION_TTL_MS })
  return { token, expiresAt: now + CONFIRMATION_TTL_MS }
}

/** True once for a live token issued for exactly this action and target. */
export function consumeConfirmation(
  token: unknown,
  action: ConfirmedAction,
  target: string,
): boolean {
  if (typeof token !== 'string') return false
  const entry = issued.get(token)
  issued.delete(token)
  return (
    entry !== undefined &&
    entry.action === action &&
    entry.target === target &&
    entry.expiresAt > Date.now()
  )
}
