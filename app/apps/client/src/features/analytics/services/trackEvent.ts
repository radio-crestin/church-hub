import posthog from 'posthog-js'

import type { ClientEventName, ClientEventProperties } from '../analyticsEvents'

/**
 * Sends one of the events in analyticsEvents.ts, typed to its properties.
 * Does nothing while PostHog is not started (usage data off, /screen/*).
 */
export function trackEvent<E extends ClientEventName>(
  name: E,
  properties: ClientEventProperties<E> = {},
): void {
  if (!posthog.__loaded || posthog.has_opted_out_capturing()) return
  posthog.capture(name, properties)
}
