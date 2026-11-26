import type { NodeSettings, RateLimitRule } from './types'

/** The Worker's rate-limit bindings (wrangler.toml): 3 calls a minute each. */
const DEFAULT_PER_MINUTE = 3

export type RateLimiterName =
  | 'FEATURE_REQUEST_RATE_LIMITER'
  | 'SYNC_RATE_LIMITER'

/**
 * A limiter's rule: `<name minus _RATE_LIMITER>_RATE_LIMIT_PER_MINUTE` from
 * the environment (e.g. SYNC_RATE_LIMIT_PER_MINUTE), else the Worker's 3.
 */
export function readRateLimitRule(
  settings: NodeSettings,
  name: RateLimiterName
): RateLimitRule {
  const variable = name.replace(/_RATE_LIMITER$/, '_RATE_LIMIT_PER_MINUTE')
  const configured = settings[variable]
  const limit = configured ? Number(configured) : DEFAULT_PER_MINUTE
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`${variable} must be a positive whole number`)
  }
  return { limit, periodSeconds: 60 }
}
