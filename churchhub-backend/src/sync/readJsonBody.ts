import type { Context } from 'hono'
import { SyncError } from './SyncError'

/** The request's JSON body (its size is capped by syncBodyLimit); 400 when not JSON. */
export async function readJsonBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => {
    throw new SyncError(400, 'invalid_request', 'Body must be JSON')
  })
}
