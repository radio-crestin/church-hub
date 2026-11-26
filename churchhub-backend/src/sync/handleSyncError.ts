import type { Context } from 'hono'
import { redactChurchPaths } from './redactChurchPaths'
import { SyncError } from './SyncError'

/**
 * Every error a /sync route raises, as `{ error, code, ...details }`. An
 * unexpected one is logged without the church paths its message may name.
 */
export function handleSyncError(error: Error, c: Context): Response {
  if (error instanceof SyncError) {
    return c.json(
      { error: error.message, code: error.code, ...error.details },
      error.status
    )
  }
  console.error(
    '[sync] request failed:',
    redactChurchPaths(error.stack ?? String(error))
  )
  return c.json({ error: 'Internal server error', code: 'internal' }, 500)
}
