import type { Context } from 'hono'

/**
 * The caller's address, for rate limits: `CF-Connecting-IP` only. Cloudflare
 * sets it on the Worker; on Node the server replaces it with the address it
 * resolved from the socket and trusted proxies (node/resolveClientIp,
 * node/withClientIp). X-Forwarded-For is never read here: off a trusted
 * proxy it is the client's own claim.
 */
export function clientIp(c: Context): string {
  return c.req.header('CF-Connecting-IP') ?? 'unknown'
}
