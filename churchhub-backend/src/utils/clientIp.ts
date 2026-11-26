import type { Context } from 'hono'

/**
 * The visitor's address, the one place routes read it: CF-Connecting-IP,
 * which Cloudflare sets on the Worker, and which the Node entry sets from
 * trusted proxies only (src/node/resolveClientIp.ts), replacing any value
 * the client sent. 'unknown' when neither set it.
 */
export function clientIp(c: Context): string {
  return c.req.header('CF-Connecting-IP') ?? 'unknown'
}
