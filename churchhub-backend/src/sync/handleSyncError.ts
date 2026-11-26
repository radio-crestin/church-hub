import type { Context } from 'hono'
import { SyncError } from './SyncError'

/** Every error a /sync route raises, as `{ error, code, ...details }`. */
export function handleSyncError(error: Error, c: Context): Response {
  if (error instanceof SyncError) {
    return c.json(
      { error: error.message, code: error.code, ...error.details },
      error.status
    )
  }
  console.error('[sync] request failed:', error)
  return c.json({ error: 'Internal server error', code: 'internal' }, 500)
}
