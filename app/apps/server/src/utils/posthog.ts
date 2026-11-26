import { PostHog } from 'posthog-node'

import {
  getAnalyticsConfig,
  scrubForAnalytics,
  scrubValueForAnalytics,
} from '../service/analytics'

const DEFAULT_TOKEN = 'phc_x4iC8SNTkLtxooGYmbz6v3nFjYE2v6wXaNgZVHNaxatK'
const DEFAULT_HOST = 'https://eu.i.posthog.com'

const token = process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN || DEFAULT_TOKEN
const host = process.env.VITE_PUBLIC_POSTHOG_HOST || DEFAULT_HOST

const client = new PostHog(token, {
  host,
  flushAt: 1,
  flushInterval: 5000,
  // No location lookup from the request's IP.
  disableGeoip: true,
})

/**
 * Sent with every server event. Anonymous: no person profile, no IP stored
 * (`$ip: null` keeps PostHog from filling it in from the request), no
 * location lookup. See docs/privacy-policy.md.
 */
const baseProps = {
  component: 'server',
  release: `church-hub@${process.env.npm_package_version || process.env.APP_VERSION || '0.0.0'}`,
  environment:
    process.env.NODE_ENV === 'production' ? 'production' : 'development',
  $process_person_profile: false,
  $ip: null,
  $geoip_disable: true,
}

/** The random install id, while the user lets us send usage data; else null. */
function consentedInstallId(): string | null {
  const { enabled, installId } = getAnalyticsConfig()
  return enabled ? installId : null
}

export function captureException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const distinctId = consentedInstallId()
  if (!distinctId) return
  const err = error instanceof Error ? error : new Error(String(error))
  const scrubbed = new Error(scrubForAnalytics(err.message))
  scrubbed.name = err.name
  scrubbed.stack = err.stack ? scrubForAnalytics(err.stack) : undefined
  client.captureException(scrubbed, distinctId, {
    ...baseProps,
    ...scrubValueForAnalytics(extra),
  })
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  extra?: Record<string, unknown>,
): void {
  const distinctId = consentedInstallId()
  if (!distinctId) return
  client.capture({
    distinctId,
    event: 'server_message',
    properties: {
      ...baseProps,
      level,
      message: scrubForAnalytics(message),
      ...scrubValueForAnalytics(extra),
    },
  })
}

/**
 * Fired once at server boot so we can verify in the PostHog dashboard
 * that the sidecar's outbound capture path is wired correctly. Use the
 * `app_started` event filter and look for `component:"server"` to confirm.
 */
export function captureAppStarted(): void {
  const distinctId = consentedInstallId()
  if (!distinctId) return
  client.capture({
    distinctId,
    event: 'app_started',
    properties: { ...baseProps },
  })
}

/**
 * posthog-node retries the flush for up to 30 s by default (with no network,
 * the whole 30 s), and the server holds its port until it exits: the next
 * launch would find the port taken (T-149). Two seconds sends what it can.
 */
const SHUTDOWN_TIMEOUT_MS = 2000

export async function shutdownPostHog(): Promise<void> {
  try {
    await client.shutdown(SHUTDOWN_TIMEOUT_MS)
  } catch {
    // best-effort flush
  }
}
