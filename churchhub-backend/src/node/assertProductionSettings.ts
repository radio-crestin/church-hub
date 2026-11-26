import type { NodeSettings } from './types'

/**
 * Settings a production deployment can't run safely without. Without Redis
 * each replica keeps its own limits and signaling rooms; without trusted
 * proxies every visitor shares the ingress address, and so one rate limit.
 */
export function assertProductionSettings(settings: NodeSettings): void {
  if (settings.NODE_ENV !== 'production') return
  if (!settings.REDIS_URL) {
    throw new Error(
      'REDIS_URL is required in production: limits and signaling must be shared by every replica',
    )
  }
  if (!settings.TRUSTED_PROXY_CIDRS?.trim()) {
    throw new Error(
      'TRUSTED_PROXY_CIDRS is required in production: set it to the ingress range, or every visitor shares one rate limit',
    )
  }
}
