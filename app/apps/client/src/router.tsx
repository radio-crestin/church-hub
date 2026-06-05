import { createRouter, RouterProvider } from '@tanstack/react-router'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

// Initialize PostHog early for error tracking
import { initPostHog, posthog } from './posthog'

initPostHog()

// Initialize global error handlers for unhandled errors and rejections
import { captureError, initGlobalErrorHandlers } from './utils/error-handler'

try {
  initGlobalErrorHandlers()
} catch {
  // Silently fail if error handlers can't be initialized (e.g., SSR)
}

import { getApiUrl, isMobile, needsApiUrlConfiguration } from './config'
import { ApiUrlSetup } from './features/api-url-config'
import { routeTree } from './routeTree.gen'
import DefaultCatchBoundary from './ui/DefaultCatchBoundary'
import { ErrorBoundary } from './ui/error-boundary'
import { getServerConfig } from './utils/tauri-commands'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // Catch + report render errors thrown inside route components.
  defaultErrorComponent: DefaultCatchBoundary,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch on mobile (iOS WKWebView blocks HTTP fetch)
const fetchFn = isTauri && isMobile() ? tauriFetch : window.fetch.bind(window)

// Startup timing
const clientStartTime = performance.now()
const logClientTiming = (label: string) => {
  // biome-ignore lint/suspicious/noConsole: startup timing logging
  console.log(
    `[client-startup] ${label}: ${(performance.now() - clientStartTime).toFixed(1)}ms`,
  )
}

logClientTiming('script_loaded')

// Log time since HTML loaded (shows Vite module transformation time)
if (typeof window !== 'undefined' && window.__htmlLoadTime) {
  const moduleLoadTime = performance.now() - window.__htmlLoadTime
  // biome-ignore lint/suspicious/noConsole: startup timing logging
  console.log(
    `[client-startup] module_executed (time since HTML): ${moduleLoadTime.toFixed(1)}ms`,
  )
}

// Check Tauri context early
const isTauriCheck =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
logClientTiming(`tauri_check (isTauri=${isTauriCheck})`)

// Loading-screen helpers — the screen markup lives in index.html so it
// paints before any module loads. These helpers nudge what the user
// sees while we wait for the sidecar and the first React mount.

// Localized bootstrap strings. This code runs BEFORE React (and therefore
// before react-i18next) mounts, so we can't use the normal i18n hooks here —
// we read the persisted language key directly and keep a tiny en/ro table for
// the handful of strings the loading screen needs. Keep these in sync with the
// `common` namespace where it makes sense.
const startupLang: 'en' | 'ro' = (() => {
  try {
    return localStorage.getItem('church-hub-language') === 'ro' ? 'ro' : 'en'
  } catch {
    return 'en'
  }
})()

const STARTUP_STRINGS = {
  starting: { en: 'Starting Church Hub', ro: 'Se pornește Church Hub' },
  connecting: { en: 'Connecting to server', ro: 'Se conectează la server' },
  migrating: {
    en: 'Updating the database',
    ro: 'Se actualizează baza de date',
  },
  indexing: {
    en: 'Building the search index',
    ro: 'Se construiește indexul de căutare',
  },
  finalizing: { en: 'Getting things ready', ro: 'Se finalizează pregătirea' },
  firstRunHint: {
    en: 'Setting things up for the first time — this only happens once.',
    ro: 'Se face configurarea inițială — se întâmplă o singură dată.',
  },
  longHint: {
    en: 'This is taking longer than usual…',
    ro: 'Durează mai mult decât de obicei…',
  },
  errorUnreachable: {
    en: "Couldn't reach the local server",
    ro: 'Nu s-a putut contacta serverul local',
  },
  errorRemote: {
    en: "Couldn't reach the server",
    ro: 'Nu s-a putut contacta serverul',
  },
  errorBootFailed: {
    en: 'Church Hub could not finish starting',
    ro: 'Church Hub nu a putut finaliza pornirea',
  },
  retry: { en: 'Retry', ro: 'Reîncearcă' },
  retryHint: {
    en: 'Tap retry below — or fully quit and reopen Church Hub.',
    ro: 'Apasă reîncearcă mai jos — sau închide complet și redeschide Church Hub.',
  },
  reported: {
    en: 'The error was reported to the team automatically.',
    ro: 'Eroarea a fost raportată automat echipei.',
  },
} as const

const tr = (key: keyof typeof STARTUP_STRINGS): string =>
  STARTUP_STRINGS[key][startupLang]

/** Map a server boot phase to its localized loading message. */
function localizedPhase(phase: string | undefined): string | undefined {
  switch (phase) {
    case 'starting':
      return tr('starting')
    case 'migrating':
      return tr('migrating')
    case 'indexing':
      return tr('indexing')
    case 'finalizing':
      return tr('finalizing')
    default:
      return undefined
  }
}

function updateLoadingMessage(message: string) {
  const el = document.getElementById('loading-message')
  if (el) el.textContent = message
}

function updateLoadingHint(message: string) {
  const el = document.getElementById('loading-hint')
  if (el) el.textContent = message
}

function setLoadingError(
  message: string,
  onRetry: () => void,
  detail?: string,
): void {
  const screen = document.getElementById('loading-screen')
  if (!screen) return
  const spinner = document.getElementById('loading-spinner')
  if (spinner) spinner.style.display = 'none'
  updateLoadingMessage(message)
  // Hint line carries the actionable instruction; an optional detail line shows
  // the underlying technical reason (e.g. which migration failed).
  updateLoadingHint(tr('retryHint'))

  const content = document.getElementById('loading-content')

  // Technical detail (only when we have a concrete server-reported reason).
  let detailEl = document.getElementById('loading-detail')
  if (detail) {
    if (!detailEl) {
      detailEl = document.createElement('div')
      detailEl.id = 'loading-detail'
      detailEl.setAttribute(
        'style',
        'margin:0;color:#6b7280;font-size:12px;line-height:1.5;max-width:340px;word-break:break-word;',
      )
      content?.appendChild(detailEl)
    }
    detailEl.textContent = detail
  } else if (detailEl) {
    detailEl.textContent = ''
  }

  let retry = document.getElementById(
    'loading-retry',
  ) as HTMLButtonElement | null
  if (!retry) {
    retry = document.createElement('button')
    retry.id = 'loading-retry'
    retry.textContent = tr('retry')
    retry.setAttribute(
      'style',
      'margin-top:16px;padding:10px 20px;border:none;border-radius:8px;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;',
    )
    content?.appendChild(retry)
  }
  retry.textContent = tr('retry')
  retry.removeAttribute('disabled')

  // "Reported to the team" reassurance — we always auto-report startup
  // failures, so tell the user they don't need to do anything else.
  let reportedEl = document.getElementById('loading-reported')
  if (!reportedEl) {
    reportedEl = document.createElement('div')
    reportedEl.id = 'loading-reported'
    reportedEl.setAttribute(
      'style',
      'margin-top:8px;color:#4b5563;font-size:11px;line-height:1.5;',
    )
    content?.appendChild(reportedEl)
  }
  reportedEl.textContent = tr('reported')

  retry.onclick = () => {
    // Re-run the polling path instead of reloading the page: a full reload
    // re-downloads the bundle and loses our diagnostics, and for a still-booting
    // server the spinner just needs more time, not a restart.
    retry?.setAttribute('disabled', 'true')
    retry?.setAttribute(
      'style',
      `${retry?.getAttribute('style') ?? ''}opacity:0.6;cursor:wait;`,
    )
    const spinnerEl = document.getElementById('loading-spinner')
    if (spinnerEl) spinnerEl.style.display = ''
    updateLoadingHint('')
    if (detailEl) detailEl.textContent = ''
    if (reportedEl) reportedEl.textContent = ''
    onRetry()
  }
}

function hideLoadingScreen() {
  const loadingEl = document.getElementById('loading-screen')
  if (loadingEl) {
    loadingEl.style.opacity = '0'
    loadingEl.style.transition = 'opacity 0.3s ease-out'
    setTimeout(() => loadingEl.remove(), 300)
  }
}

/** Shape of the server's `/health` response (boot server + real server). */
interface HealthSnapshot {
  phase?: string
  message?: string
  ready?: boolean
  error?: { phase: string; message: string; stack?: string } | null
}

/** Outcome of polling `/health` until the server is ready or we give up. */
type StartupResult =
  | { status: 'ready'; totalWaitMs: number; attempts: number }
  | {
      status: 'boot_failed'
      phase: string
      message: string
      totalWaitMs: number
      attempts: number
    }
  | {
      status: 'unreachable'
      totalWaitMs: number
      attempts: number
      lastError: string
      everReachable: boolean
    }

// Never saw a single response: the sidecar process likely failed to spawn or
// crashed before binding. Generous so a slow first launch on a cold disk isn't
// mistaken for a crash.
const UNREACHABLE_BUDGET_MS = 90_000
// Saw the boot server but it never reached `ready`: a wedged migration that
// neither completes nor throws. Surfaced as a reportable failure after this.
const STUCK_BUDGET_MS = 300_000

/**
 * Poll the server's `/health` endpoint until it reports `ready`, fails, or we
 * exhaust the budget. Unlike the old `/ping` wait, this reads the structured
 * boot phase so the loading screen shows real progress ("Updating the
 * database", "Building the search index") and — crucially — detects a hard
 * boot failure immediately instead of spinning for minutes on a timeout.
 */
async function pollServerHealth(apiUrl: string): Promise<StartupResult> {
  const healthUrl = `${apiUrl}/health`
  const start = performance.now()
  const retryDelay = isTauriCheck ? 250 : 500

  let everReachable = false
  let lastError = 'no response'
  let attempts = 0
  let firstRunHintShown = false
  let longHintShown = false

  for (;;) {
    attempts++
    const elapsed = performance.now() - start

    try {
      // Per-attempt AbortController — a stale TCP connection that hangs
      // shouldn't burn the whole budget on a single fetch.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      try {
        const response = await fetchFn(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        })
        if (response.ok) {
          everReachable = true
          const snap = (await response
            .json()
            .catch(() => null)) as HealthSnapshot | null

          if (snap?.error) {
            // biome-ignore lint/suspicious/noConsole: startup failure logging
            console.error(
              `[client-startup] server boot failed (phase=${snap.error.phase}): ${snap.error.message}`,
            )
            return {
              status: 'boot_failed',
              phase: snap.error.phase,
              message: snap.error.message,
              totalWaitMs: Math.round(elapsed),
              attempts,
            }
          }
          if (snap?.ready) {
            // biome-ignore lint/suspicious/noConsole: startup timing logging
            console.log(
              `[client-startup] server ready: attempt=${attempts}, totalWait=${Math.round(elapsed)}ms`,
            )
            return {
              status: 'ready',
              totalWaitMs: Math.round(elapsed),
              attempts,
            }
          }
          // Still booting — reflect the current phase on the loading screen.
          const phaseMessage = localizedPhase(snap?.phase) ?? snap?.message
          if (phaseMessage) updateLoadingMessage(phaseMessage)
        } else {
          lastError = `HTTP ${response.status}`
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (err) {
      // Connection refused (process not up / handoff gap) or fetch timeout.
      lastError =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'timeout'
          : err instanceof Error
            ? err.message
            : 'fetch failed'
    }

    if (!firstRunHintShown && elapsed > 1500) {
      updateLoadingHint(tr('firstRunHint'))
      firstRunHintShown = true
    }
    if (!longHintShown && elapsed > 20_000) {
      updateLoadingHint(tr('longHint'))
      longHintShown = true
    }

    // Give up only when we're confident this isn't just a slow-but-progressing
    // boot: either we never reached the server at all, or it stayed reachable
    // yet never became ready within a very generous window.
    if (!everReachable && elapsed > UNREACHABLE_BUDGET_MS) {
      return {
        status: 'unreachable',
        totalWaitMs: Math.round(elapsed),
        attempts,
        lastError,
        everReachable,
      }
    }
    if (everReachable && elapsed > STUCK_BUDGET_MS) {
      return {
        status: 'unreachable',
        totalWaitMs: Math.round(elapsed),
        attempts,
        lastError: 'boot did not complete within 5 minutes',
        everReachable,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay))
  }
}

/**
 * Report a startup failure to PostHog (a filterable `startup_failed` event plus
 * a captured exception) and the console/log. This is how a maintainer learns
 * that a release wedges on boot in the field — the old code only logged to a
 * console nobody sees.
 *
 * The raw `lastError` (which can be the dropped-by-default "Failed to fetch")
 * is kept in event properties, never in the exception message, so the report
 * isn't silently filtered out.
 */
function reportStartupFailure(
  result: Exclude<StartupResult, { status: 'ready' }>,
  scope: 'desktop' | 'remote',
): void {
  const diagnostics: Record<string, unknown> = {
    source: 'startup',
    scope,
    status: result.status,
    total_wait_ms: result.totalWaitMs,
    attempts: result.attempts,
    app_version: window.__appVersion,
    env_mode: window.__envMode,
    language: startupLang,
    platform: navigator.platform,
    user_agent: navigator.userAgent,
  }

  let message: string
  if (result.status === 'boot_failed') {
    diagnostics.boot_phase = result.phase
    diagnostics.boot_message = result.message
    message = `Startup failed: server boot wedged during "${result.phase}"`
  } else {
    diagnostics.last_error = result.lastError
    diagnostics.ever_reachable = result.everReachable
    message = `Startup failed: server unreachable after ${Math.round(
      result.totalWaitMs / 1000,
    )}s`
  }

  captureError(new Error(message), {
    source: 'startup',
    component: 'router',
    ...diagnostics,
  })
  try {
    posthog.capture('startup_failed', diagnostics)
  } catch {
    // PostHog not ready — the captureError above already logged it.
  }
}

// App wrapper that handles mobile API URL configuration
function App() {
  const [needsSetup, setNeedsSetup] = React.useState(needsApiUrlConfiguration())

  if (needsSetup) {
    return (
      <ApiUrlSetup
        onComplete={() => {
          setNeedsSetup(false)
          // Reload to reinitialize with the new API URL
          window.location.reload()
        }}
      />
    )
  }

  // ErrorBoundary is the outermost safety net — it catches render crashes the
  // router's defaultErrorComponent can't (e.g. failures in providers/layout).
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}

let reactMounted = false

/** Mount React once the server is ready (idempotent). */
function mountReact() {
  const rootElement = document.getElementById('app')
  if (!rootElement || reactMounted || rootElement.innerHTML) return
  reactMounted = true
  logClientTiming('before_react_mount')
  const root = ReactDOM.createRoot(rootElement)
  logClientTiming('react_root_created')
  root.render(<App />)
  logClientTiming('react_render_called')
}

/**
 * Desktop startup: poll the local sidecar, then either mount the app or show an
 * actionable, auto-reported error. Re-entrant so the Retry button can re-run it.
 */
async function runDesktopStartup(): Promise<void> {
  updateLoadingMessage(tr('starting'))
  logClientTiming('before_getServerConfig')
  const serverConfig = await getServerConfig()
  logClientTiming('after_getServerConfig')
  if (serverConfig) {
    window.__serverConfig = { serverPort: serverConfig.serverPort }
  }

  const apiUrl = getApiUrl() as string
  logClientTiming('before_pollServerHealth')
  const result = await pollServerHealth(apiUrl)
  logClientTiming('after_pollServerHealth')

  if (result.status === 'ready') {
    hideLoadingScreen()
    mountReact()
    logClientTiming('loading_screen_hidden')
    return
  }

  reportStartupFailure(result, 'desktop')
  const title =
    result.status === 'boot_failed'
      ? tr('errorBootFailed')
      : tr('errorUnreachable')
  const detail = result.status === 'boot_failed' ? result.message : undefined
  setLoadingError(title, () => void runDesktopStartup(), detail)
}

/**
 * Mobile startup: connect to the configured remote server (or show the setup
 * screen when none is configured yet).
 */
async function runMobileStartup(): Promise<void> {
  logClientTiming('mobile_mode')
  if (needsApiUrlConfiguration()) {
    hideLoadingScreen()
    mountReact()
    return
  }

  const apiUrl = getApiUrl()
  if (!apiUrl) {
    hideLoadingScreen()
    mountReact()
    return
  }

  updateLoadingMessage(tr('connecting'))
  const result = await pollServerHealth(apiUrl)

  if (result.status === 'ready') {
    hideLoadingScreen()
    mountReact()
    return
  }

  reportStartupFailure(result, 'remote')
  const detail = result.status === 'boot_failed' ? result.message : undefined
  setLoadingError(tr('errorRemote'), () => void runMobileStartup(), detail)
}

// See vite-env.d.ts to set type
if (typeof window !== 'undefined') {
  // See `vite.config.ts` for all defined values.
  window.__appVersion = __appVersion
  window.__envMode = __envMode

  if (isTauri) {
    logClientTiming('tauri_block_start')
    const startup = isMobile() ? runMobileStartup() : runDesktopStartup()
    startup.catch((error) => {
      // biome-ignore lint/suspicious/noConsole: error logging for startup
      console.error('[router] Unexpected startup error:', error)
      captureError(error, { source: 'startup', component: 'router' })
      setLoadingError(
        tr('errorUnreachable'),
        () => window.location.reload(),
        error instanceof Error ? error.message : String(error),
      )
    })
  } else {
    // Not in Tauri (web/dev) — the server is already up, mount immediately.
    hideLoadingScreen()
    mountReact()
  }
}

logClientTiming('script_complete')
