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

/**
 * Routes that must NEVER show PostHog UI. /screen/* is rendered on
 * projectors and OBS scenes — surfacing the support widget there would
 * leak our internal chrome onto the church's main screen.
 *
 * We don't merely hide the widget on these routes; we skip `posthog.init`
 * entirely so no token, no replay, no autocapture is set up. A reload
 * onto a non-screen route gets a fresh init.
 */
function isPostHogDisabledRoute(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/screen/')
}

export function initPostHog(): void {
  if (isPostHogDisabledRoute()) {
    return
  }

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

  // Boot heartbeat — filter `app_started` + `component:"client"` in the
  // PostHog dashboard to confirm the client's capture path is healthy.
  posthog.capture('app_started')

  // PostHog conversations auto-injects a floating chat button on every page
  // by default. We don't want it: the chat must only open when the user
  // clicks our sidebar Feedback entry. Hide as soon as the extension is
  // available; the gate keeps polling until conversations loads.
  hideConversationsWidgetOnceAvailable()
}

function hideConversationsWidgetOnceAvailable(): void {
  let attempts = 0
  const tick = () => {
    if (posthog.conversations?.isAvailable?.()) {
      try {
        posthog.conversations.hide()
      } catch {
        // ignore
      }
      return
    }
    attempts += 1
    // Stop polling after ~30s — if it never loads, the feature is off and
    // there's nothing to hide.
    if (attempts > 60) return
    window.setTimeout(tick, 500)
  }
  tick()
}

export { posthog }
