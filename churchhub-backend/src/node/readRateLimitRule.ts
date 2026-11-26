import type { NodeSettings, RateLimitRule } from './types'

/** The Worker's rate-limit bindings (wrangler.toml), calls a minute. */
const DEFAULT_PER_MINUTE = {
  FEATURE_REQUEST_RATE_LIMITER: 3,
  SYNC_RATE_LIMITER: 3,
  BACKUP_RATE_LIMITER: 60,
  BACKUP_ACCOUNT_RATE_LIMITER: 30,
}

export type RateLimiterName = keyof typeof DEFAULT_PER_MINUTE

/**
 * A limiter's rule: `<name minus _RATE_LIMITER>_RATE_LIMIT_PER_MINUTE` from
 * the environment (e.g. SYNC_RATE_LIMIT_PER_MINUTE), else the Worker's.
 */
export function readRateLimitRule(
  settings: NodeSettings,
  name: RateLimiterName
): RateLimitRule {
  const variable = name.replace(/_RATE_LIMITER$/, '_RATE_LIMIT_PER_MINUTE')
  const configured = settings[variable]
  const limit = configured ? Number(configured) : DEFAULT_PER_MINUTE[name]
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`${variable} must be a positive whole number`)
  }
  return { limit, periodSeconds: 60 }
}
