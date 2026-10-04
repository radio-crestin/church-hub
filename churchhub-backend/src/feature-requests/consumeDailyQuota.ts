import { DAILY_REQUEST_LIMIT, DAILY_WINDOW_MS } from './constants'
import { hashClientIp } from './hashClientIp'

const KEY_PREFIX = 'feature-request-quota:'

/**
 * Rolling 24-hour cap per client IP. Each IP (hashed) keeps the timestamps
 * of its requests from the last 24 hours in KV; a request is allowed while
 * fewer than DAILY_REQUEST_LIMIT remain, and is then recorded. KV is
 * eventually consistent, so simultaneous requests can slip a few over the
 * cap; the per-minute rate-limit binding keeps such bursts small.
 * Returns false when the IP is over the limit.
 */
export async function consumeDailyQuota(
  kv: KVNamespace,
  ip: string,
  secret: string,
  now = Date.now()
): Promise<boolean> {
  const key = `${KEY_PREFIX}${await hashClientIp(ip, secret)}`
  const stored = (await kv.get<number[]>(key, 'json')) ?? []
  const recent = stored.filter((time) => now - time < DAILY_WINDOW_MS)
  if (recent.length >= DAILY_REQUEST_LIMIT) return false

  await kv.put(key, JSON.stringify([...recent, now]), {
    expirationTtl: DAILY_WINDOW_MS / 1000,
  })
  return true
}
