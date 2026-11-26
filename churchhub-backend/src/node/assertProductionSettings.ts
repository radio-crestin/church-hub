import type { NodeSettings } from './types'

/**
 * Settings a production deployment can't run safely without. Without Redis
 * each replica keeps its own limits and signaling rooms, so production needs
 * Redis unless SINGLE_INSTANCE=true declares one replica (then its memory is
 * the shared state). Without trusted proxies every visitor shares the ingress
 * address, and so one rate limit.
 */
export function assertProductionSettings(settings: NodeSettings): void {
  if (settings.NODE_ENV !== 'production') return
  if (!settings.REDIS_URL && !isSingleInstance(settings)) {
    throw new Error(
      'REDIS_URL is required in production: limits and signaling must be shared by every replica (or set SINGLE_INSTANCE=true when exactly one runs)',
    )
  }
  if (!settings.TRUSTED_PROXY_CIDRS?.trim()) {
    throw new Error(
      'TRUSTED_PROXY_CIDRS is required in production: set it to the ingress range, or every visitor shares one rate limit',
    )
  }
}

/** The deployment runs exactly one replica: memory holds the shared state. */
export function isSingleInstance(settings: NodeSettings): boolean {
  return settings.SINGLE_INSTANCE?.trim().toLowerCase() === 'true'
}
