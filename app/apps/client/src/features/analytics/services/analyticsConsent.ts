import { fetcher } from '~/utils/fetcher'

const CACHE_KEY = 'church-hub:usage-data'

export interface AnalyticsConsent {
  enabled: boolean
  installId: string
}

/**
 * The last answer the server gave on this device, so PostHog starts (or
 * stays off) at once on the next load. Null on a device that never asked.
 */
export function getCachedConsent(): AnalyticsConsent | null {
  const raw = localStorage.getItem(CACHE_KEY)
  return raw ? (JSON.parse(raw) as AnalyticsConsent) : null
}

function cacheConsent(consent: AnalyticsConsent): AnalyticsConsent {
  localStorage.setItem(CACHE_KEY, JSON.stringify(consent))
  return consent
}

/** GET /api/analytics (public): may usage data be sent, and the install id. */
export async function fetchConsent(): Promise<AnalyticsConsent> {
  const { data } = await fetcher<{ data: AnalyticsConsent }>('/api/analytics')
  return cacheConsent(data)
}

/** PUT /api/analytics: turns usage data on or off for the whole install. */
export async function saveConsent(enabled: boolean): Promise<AnalyticsConsent> {
  const response = await fetcher<{ data?: AnalyticsConsent; error?: string }>(
    '/api/analytics',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    },
  )
  if (!response.data) throw new Error(response.error ?? 'Could not save')
  return cacheConsent(response.data)
}
