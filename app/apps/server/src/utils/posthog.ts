import { hostname } from 'node:os'

import { PostHog } from 'posthog-node'

const DEFAULT_TOKEN = 'phc_x4iC8SNTkLtxooGYmbz6v3nFjYE2v6wXaNgZVHNaxatK'
const DEFAULT_HOST = 'https://eu.i.posthog.com'

const token =
  process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN || DEFAULT_TOKEN
const host = process.env.VITE_PUBLIC_POSTHOG_HOST || DEFAULT_HOST

const distinctId = (() => {
  try {
    return `server-${hostname()}`
  } catch {
    return 'server-unknown'
  }
})()

const client = new PostHog(token, {
  host,
  flushAt: 1,
  flushInterval: 5000,
})

const baseProps = {
  component: 'server',
  release: `church-hub@${process.env.npm_package_version || process.env.APP_VERSION || '0.0.0'}`,
  environment:
    process.env.NODE_ENV === 'production' ? 'production' : 'development',
}

export function captureException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  client.captureException(err, distinctId, { ...baseProps, ...extra })
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  extra?: Record<string, unknown>,
): void {
  client.capture({
    distinctId,
    event: 'server_message',
    properties: {
      ...baseProps,
      level,
      message,
      ...extra,
    },
  })
}

/**
 * Fired once at server boot so we can verify in the PostHog dashboard
 * that the sidecar's outbound capture path is wired correctly. Use the
 * `app_started` event filter and look for `component:"server"` to confirm.
 */
export function captureAppStarted(): void {
  client.capture({
    distinctId,
    event: 'app_started',
    properties: { ...baseProps },
  })
}

/**
 * Captures a feedback report under a custom distinctId (the report ID).
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

export async function shutdownPostHog(): Promise<void> {
  try {
    await client.shutdown()
  } catch {
    // best-effort flush
  }
}
