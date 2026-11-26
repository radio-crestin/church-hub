import type { Context } from 'hono'

/**
 * The host key the request carries (`Authorization: Bearer <key>`), or null
 * when it carries none. Never in the URL, so it stays out of request logs.
 */
export function readHostKey(c: Context): string | null {
  const header = c.req.header('Authorization')
  if (!header) return null
  return header.match(/^Bearer\s+(\S+)$/i)?.[1] ?? ''
}
