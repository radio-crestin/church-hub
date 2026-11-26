import type { Context } from 'hono'
import { SyncError } from '../sync/SyncError'
import { describeError } from './describeError'

/** The stack's frames (where it failed), without the message line above them. */
const framesOf = (error: Error) =>
  (error.stack ?? '')
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .slice(0, 5)
    .join('\n')

/**
 * Every error a /backup route raises, as `{ error, code, ...details }`. An
 * unexpected one is logged as its name and a known code (describeError)
 * with the stack's frames, never its message: messages can carry tokens,
 * object keys, URLs or an email.
 */
export function handleBackupError(error: Error, c: Context): Response {
  if (error instanceof SyncError) {
    return c.json(
      { error: error.message, code: error.code, ...error.details },
      error.status
    )
  }
  console.error(`[backup] request failed: ${describeError(error)}\n${framesOf(error)}`)
  return c.json({ error: 'Internal server error', code: 'internal' }, 500)
}
