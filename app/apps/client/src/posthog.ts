import posthog, { type CaptureResult } from 'posthog-js'

import {
  type AnalyticsConsent,
  fetchConsent,
  getCachedConsent,
} from './features/analytics/services/analyticsConsent'
import { getDeviceId } from './features/analytics/services/deviceId'
import { installInteractionTracking } from './features/analytics/services/installInteractionTracking'
import { trackEvent } from './features/analytics/services/trackEvent'
import {
  getCurrentFeature,
  isRouteKnown,
} from './features/analytics/utils/currentRoute'
import { sanitizeEvent } from './features/analytics/utils/sanitizeEvent'

export const POSTHOG_TOKEN =
  (import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN as string | undefined) ||
  'phc_x4iC8SNTkLtxooGYmbz6v3nFjYE2v6wXaNgZVHNaxatK'
const API_HOST =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ||
  'https://eu.i.posthog.com'

/** How long to keep asking a server that is still starting (2 s apart). */
const CONSENT_ATTEMPTS = 90

function isNoise(event: CaptureResult | null): boolean {
  const props = event?.properties ?? {}

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

  return messages.some(
    (m) =>
      m.includes('ResizeObserver loop') ||
      (m.includes('Failed to fetch') && '__TAURI_INTERNALS__' in window),
  )
}

/**
 * Routes that must NEVER show PostHog UI. /screen/* is rendered on
 * projectors and OBS scenes — surfacing the support widget there would
 * leak our internal chrome onto the church's main screen.
 *
 * We don't merely hide the widget on these routes; we skip `posthog.init`
 * entirely so no token, no replay, no events are set up. A reload
 * onto a non-screen route gets a fresh init.
 */
function isPostHogDisabledRoute(): boolean {
  return window.location.pathname.startsWith('/screen/')
}

/**
 * Starts PostHog, anonymously (see docs/privacy-policy.md): a random device
 * id, no person profile, no IP or place kept, only the events and properties
 * in features/analytics/analyticsEvents.ts, text masked in the replay.
 */
function startPostHog(installId: string): void {
  if (posthog.__loaded) return

  posthog.init(POSTHOG_TOKEN, {
    api_host: API_HOST,
    bootstrap: { distinctID: getDeviceId(POSTHOG_TOKEN) },
    person_profiles: 'never',
    internal_or_test_user_hostname: null,
    persistence: 'localStorage',
    // Pages are sent by the router with their route pattern, not their address.
    capture_pageview: false,
    capture_pageleave: true,
    // Presses are sent by our own listener, without any text (installInteractionTracking).
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    save_referrer: false,
    save_campaign_params: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    disable_surveys: true,
    // Session replay: every text and input masked, images and videos left
    // out (gallery photos, backgrounds); password fields never recorded.
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
      maskInputOptions: { password: true, email: true },
      blockSelector: 'img, video, picture, [data-ph-block]',
      recordCrossOriginIframes: false,
    },
    capture_exceptions: true,
    before_send: (event) => (isNoise(event) ? null : sanitizeEvent(event)),
  })

  // Turned off earlier on this device, then on again: PostHog keeps its own
  // opt-out, so lift it.
  if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing()

  posthog.register({
    install_id: installId,
    component: 'client',
    runtime: '__TAURI_INTERNALS__' in window ? 'tauri' : 'browser',
    release: `church-hub@${window.__appVersion || '0.0.0'}`,
    environment: window.__envMode || 'development',
  })

  // Boot heartbeat — filter `app_started` + `component:"client"` in the
  // PostHog dashboard to confirm the client's capture path is healthy.
  posthog.capture('app_started')
  // Started after the first page resolved (waiting for the server's
  // answer): that page's view was not sent yet.
  if (isRouteKnown()) trackEvent('$pageview', { feature: getCurrentFeature() })
  installInteractionTracking()

  // PostHog conversations auto-injects a floating chat button on every
  // page. We never want that button visible — feedback is opened from
  // our sidebar via the JS API. Calling `hide()` once isn't enough: the
  // widget re-shows itself after various internal events, so we keep
  // the suppression running for the life of the page.
  keepConversationsWidgetHidden()
}

/**
 * Applies the install's choice (Settings > Privacy): on starts PostHog, off
 * stops it at once — no events, no errors, no replay from this window.
 */
export function applyConsent(consent: AnalyticsConsent): void {
  if (isPostHogDisabledRoute()) return
  if (consent.enabled) {
    startPostHog(consent.installId)
    return
  }
  if (!posthog.__loaded) return
  posthog.stopSessionRecording()
  posthog.opt_out_capturing()
}

/** Asks the server (it may still be starting) and applies its answer. */
async function syncConsent(attempt = 1): Promise<void> {
  try {
    applyConsent(await fetchConsent())
  } catch {
    if (attempt < CONSENT_ATTEMPTS) {
      window.setTimeout(() => void syncConsent(attempt + 1), 2000)
    }
  }
}

/**
 * Starts PostHog at once when this device last heard usage data is on;
 * otherwise only once the server says so. A device that never asked sends
 * nothing until it knows.
 */
export function initPostHog(): void {
  if (isPostHogDisabledRoute()) return
  const cached = getCachedConsent()
  if (cached?.enabled) startPostHog(cached.installId)
  void syncConsent()
}

function keepConversationsWidgetHidden(): void {
  let loadAttempts = 0
  const armSuppression = () => {
    if (posthog.conversations?.isAvailable?.()) {
      const force = () => {
        try {
          if (posthog.conversations?.isVisible?.()) {
            posthog.conversations.hide()
          }
        } catch {
          // ignore
        }
      }
      force()
      // Periodic re-hide. 1s is responsive enough that the floating
      // button is gone before the user can act on it, and cheap enough
      // to run forever (boolean check + maybe one hide() call).
      window.setInterval(force, 1000)
      return
    }
    loadAttempts += 1
    // Conversations is opt-in per project. Stop polling after ~30s if
    // the module never loads — there's nothing to hide in that case.
    if (loadAttempts > 60) return
    window.setTimeout(armSuppression, 500)
  }
  armSuppression()
}

export { posthog }
