import type { Context } from 'hono'
import { SyncError } from './SyncError'

/** A first sync sends its library in chunks well under this. */
const BODY_MAX_BYTES = 8 * 1024 * 1024

/** The request's JSON body: 413 when too large, 400 when not JSON. */
export async function readJsonBody(c: Context): Promise<unknown> {
  if (Number(c.req.header('Content-Length') ?? 0) > BODY_MAX_BYTES) {
    throw new SyncError(413, 'too_large', 'Request is too large')
  }
  return c.req.json().catch(() => {
    throw new SyncError(400, 'invalid_request', 'Body must be JSON')
  })
}
