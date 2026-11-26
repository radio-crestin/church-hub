import type { CaptureResult } from 'posthog-js'

import { getCurrentRoute } from './currentRoute'
import { scrubValue } from './scrubText'
import {
  CLIENT_EVENTS,
  COMMON_PROPERTIES,
  POSTHOG_PROPERTIES,
  POSTHOG_PROPERTY_PREFIXES,
} from '../analyticsEvents'

const ALWAYS_ALLOWED = new Set<string>([
  ...COMMON_PROPERTIES,
  ...POSTHOG_PROPERTIES,
])

function isAllowed(event: string, key: string): boolean {
  if (ALWAYS_ALLOWED.has(key)) return true
  const own = CLIENT_EVENTS[event as keyof typeof CLIENT_EVENTS] as
    | readonly string[]
    | undefined
  if (own?.includes(key)) return true
  const prefix =
    POSTHOG_PROPERTY_PREFIXES[event as keyof typeof POSTHOG_PROPERTY_PREFIXES]
  return !!prefix && key.startsWith(prefix)
}

/**
 * PostHog's `before_send`: lets through only the events and properties in
 * analyticsEvents.ts, takes addresses and IPs out of every text, and puts
 * the route pattern where PostHog would put the page's address. Returns null
 * for any other event (rage clicks, web vitals, surveys, …).
 */
export function sanitizeEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event || !(event.event in CLIENT_EVENTS)) return null

  const properties: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event.properties ?? {})) {
    if (isAllowed(event.event, key)) properties[key] = scrubValue(value)
  }

  const route = getCurrentRoute()
  return {
    ...event,
    $set: undefined,
    $set_once: undefined,
    properties: {
      ...properties,
      $current_url: `app://church-hub${route}`,
      $host: 'church-hub',
      $pathname: route,
      route: properties.route ?? route,
      // Anonymous: no person profile, PostHog keeps no IP and looks up no place.
      $process_person_profile: false,
      $ip: null,
      $geoip_disable: true,
    },
  }
}
