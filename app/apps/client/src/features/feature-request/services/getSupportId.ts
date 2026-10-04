import { posthog } from '~/posthog'

/**
 * The PostHog distinct id: the key under which `attachFeedbackLogs` stores
 * this user's log tails. Sent privately to the maintainer (WhatsApp only)
 * so they can find the logs for a request.
 */
export function getSupportId(): string | null {
  try {
    return posthog?.get_distinct_id?.() ?? null
  } catch {
    return null
  }
}
