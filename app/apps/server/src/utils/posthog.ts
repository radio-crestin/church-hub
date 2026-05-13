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

export async function shutdownPostHog(): Promise<void> {
  try {
    await client.shutdown()
  } catch {
    // best-effort flush
  }
}
