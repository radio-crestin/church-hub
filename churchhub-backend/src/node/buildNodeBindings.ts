import type { Bindings } from '../types'
import { createMemoryKv } from './createMemoryKv'
import { createMemoryRateLimiter } from './createMemoryRateLimiter'
import { createRedisKv } from './createRedisKv'
import { createRedisRateLimiter } from './createRedisRateLimiter'
import { type RateLimiterName, readRateLimitRule } from './readRateLimitRule'
import type { NodeSettings, RedisCommands } from './types'
import { WORKER_VAR_DEFAULTS } from './workerVarDefaults'

/**
 * The Worker's bindings for the same app on Node: settings from the
 * environment, and in place of Cloudflare's KV and rate limiters either Redis
 * (shared by every replica) or this process's memory (one replica only).
 * Screenshots need no binding: without R2 they go to the S3 bucket.
 */
export function buildNodeBindings(
  settings: NodeSettings,
  redis: RedisCommands | null
): Bindings {
  const withDefaults = { ...WORKER_VAR_DEFAULTS, ...dropEmpty(settings) }
  const limiter = (name: RateLimiterName) => {
    const rule = readRateLimitRule(settings, name)
    return redis
      ? createRedisRateLimiter(redis, name, rule)
      : createMemoryRateLimiter(rule)
  }
  return {
    ...(withDefaults as unknown as Bindings),
    COOKIE_MAX_AGE: Number(withDefaults.COOKIE_MAX_AGE),
    SIGNALING_KV: redis ? createRedisKv(redis) : createMemoryKv(),
    FEATURE_REQUEST_RATE_LIMITER: limiter('FEATURE_REQUEST_RATE_LIMITER'),
    SYNC_RATE_LIMITER: limiter('SYNC_RATE_LIMITER'),
    BACKUP_RATE_LIMITER: limiter('BACKUP_RATE_LIMITER'),
    BACKUP_ACCOUNT_RATE_LIMITER: limiter('BACKUP_ACCOUNT_RATE_LIMITER'),
  }
}

/** An empty variable counts as unset, as a missing Worker binding would. */
function dropEmpty(settings: NodeSettings): Record<string, string> {
  return Object.fromEntries(
    Object.entries(settings).filter(
      (entry): entry is [string, string] => !!entry[1]
    )
  )
}
