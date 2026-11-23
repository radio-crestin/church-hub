import { getDeviceId } from '~/features/analytics/services/deviceId'
import { POSTHOG_TOKEN } from '~/posthog'

/**
 * The random device id (PostHog distinct id): the key under which
 * `attachFeedbackLogs` stores the log tails when the user sends a request.
 * Sent privately to the maintainer (WhatsApp only) so they can find them.
 */
export function getSupportId(): string {
  return getDeviceId(POSTHOG_TOKEN)
}
