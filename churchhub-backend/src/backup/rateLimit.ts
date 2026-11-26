import type { Context } from 'hono'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'
import { clientIp } from '../utils/clientIp'

/**
 * 429 rate_limited once the caller is over its limit: per IP
 * (BACKUP_RATE_LIMITER, 60 a minute) or per account
 * (BACKUP_ACCOUNT_RATE_LIMITER, 30 a minute). Cloudflare's bindings on the
 * Worker; on Node, buildNodeBindings provides them (Redis or memory). The
 * IP is the shared clientIp: never a header the client chose.
 */
export async function enforceRateLimit(
  c: Context<{ Bindings: Bindings }>,
  scope: 'ip' | 'account',
  accountId?: string
): Promise<void> {
  const binding =
    scope === 'ip'
      ? c.env.BACKUP_RATE_LIMITER
      : c.env.BACKUP_ACCOUNT_RATE_LIMITER
  if (!binding) return
  const key = scope === 'ip' ? clientIp(c) : (accountId ?? 'unknown')
  const { success } = await binding.limit({ key: `backup-${scope}:${key}` })
  if (!success) throw new SyncError(429, 'rate_limited', 'Too many requests')
}
