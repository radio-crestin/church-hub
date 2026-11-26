import type { Context } from 'hono'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'

/** Requests per minute when no rate-limit binding is there (Node, Bun). */
export const FALLBACK_LIMITS = { ip: 60, account: 30 }
const WINDOW_MS = 60_000

interface Window {
  startedAt: number
  count: number
}

const windows = new Map<string, Window>()

/**
 * A fixed one-minute window per key, in this process's memory: the Node
 * service's equivalent of Cloudflare's rate-limit binding.
 */
export function limitInMemory(key: string, limit: number, now = Date.now()) {
  for (const [name, window] of windows) {
    if (now - window.startedAt >= WINDOW_MS) windows.delete(name)
  }
  const window = windows.get(key) ?? { startedAt: now, count: 0 }
  window.count++
  windows.set(key, window)
  return window.count <= limit
}

/**
 * The address the request came from: Cloudflare's header, else the first
 * X-Forwarded-For hop (an ingress in front of the Node service).
 */
export function clientIp(c: Context): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/**
 * 429 rate_limited once `key` is over its limit: through the binding on
 * Cloudflare (BACKUP_RATE_LIMITER per IP, BACKUP_ACCOUNT_RATE_LIMITER per
 * account), in memory elsewhere.
 */
export async function enforceRateLimit(
  env: Bindings,
  scope: keyof typeof FALLBACK_LIMITS,
  key: string
): Promise<void> {
  const binding =
    scope === 'ip' ? env.BACKUP_RATE_LIMITER : env.BACKUP_ACCOUNT_RATE_LIMITER
  const allowed = binding
    ? (await binding.limit({ key: `backup-${scope}:${key}` })).success
    : limitInMemory(`${scope}:${key}`, FALLBACK_LIMITS[scope])
  if (!allowed) throw new SyncError(429, 'rate_limited', 'Too many requests')
}
