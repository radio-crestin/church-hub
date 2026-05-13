import posthog from 'posthog-js'

const DEFAULT_TOKEN = 'phc_x4iC8SNTkLtxooGYmbz6v3nFjYE2v6wXaNgZVHNaxatK'
const DEFAULT_HOST = 'https://eu.i.posthog.com'

function shouldDropEvent(event: { properties?: Record<string, unknown> }): boolean {
  const props = event.properties ?? {}

  // posthog-js puts thrown errors into $exception_list / $exception_message.
  // We mirror Sentry's old filter: drop ResizeObserver noise + Tauri "Failed to fetch"
  // (server restart races).
  const messages: string[] = []
  const topMsg = props.$exception_message
  if (typeof topMsg === 'string') messages.push(topMsg)

  const list = props.$exception_list
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item && typeof item === 'object') {
        const m = (item as Record<string, unknown>).value
        if (typeof m === 'string') messages.push(m)
      }
    }
  }

  for (const m of messages) {
    if (m.includes('ResizeObserver loop')) return true
    if (m.includes('Failed to fetch') && '__TAURI_INTERNALS__' in window) return true
  }

  return false
}

export function initPostHog(): void {
  const token =
    (import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN as string | undefined) ||
    DEFAULT_TOKEN
  const apiHost =
    (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ||
    DEFAULT_HOST

  posthog.init(token, {
    api_host: apiHost,
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    persistence: 'localStorage',
    // Session replay replaces a 3rd-party recorder (Hotjar/FullStory/etc). Privacy:
    // mask all text + inputs by default; never record password fields under any
    // circumstance; ignore the system-token field which renders raw on Settings.
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask], [data-system-token], code, pre',
      maskInputOptions: {
        password: true,
        email: true,
      },
      blockSelector: '[data-ph-block]',
      recordCrossOriginIframes: false,
    },
    capture_exceptions: true,
    before_send: (event) => {
      if (!event) return null
      if (shouldDropEvent(event)) return null
      try {
        event.properties = {
          ...event.properties,
          route: window.location.pathname,
        }
      } catch {
        // ignore
      }
      return event
    },
  })

  posthog.register({
    component: 'client',
    runtime: '__TAURI_INTERNALS__' in window ? 'tauri' : 'browser',
    release: `church-hub@${window.__appVersion || '0.0.0'}`,
    environment: window.__envMode || 'development',
  })
}

export { posthog }
