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
 * Captures a feedback report under a custom distinctId (the report ID).
 * Sent only when the user sends a feature request, so it goes even with
 * usage data turned off: the user chose to send it.
 *
 * The triage flow: the user-facing feedback message embeds the report ID,
 * the GitHub issue references it, and the maintainer queries PostHog for
 * that distinctId to see the captured logs + system info. Keeping the log
 * payload out of the GitHub issue avoids leaking IP/path/user data into
 * a public issue tracker.
 */
export function captureFeedbackReport(
  reportId: string,
  props: Record<string, unknown>,
): void {
  client.capture({
    distinctId: reportId,
    event: '$feedback_report',
    properties: {
      ...baseProps,
      ...props,
      report_id: reportId,
    },
  })
}

/**
 * Forces queued events to flush — call before a tight critical-path response
 * (e.g. feedback POST) so the user's submission lands in PostHog before the
 * HTTP response returns. Safe to await; swallows errors.
 */
export async function flushPostHog(): Promise<void> {
  try {
    await client.flush()
  } catch {
    // best-effort
  }
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
