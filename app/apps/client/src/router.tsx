import { createRouter, RouterProvider } from '@tanstack/react-router'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import './features/presentation/utils/bundledFonts'

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
import {
  hideLoadingScreen,
  setLoadingError,
  updateLoadingMessage,
} from './features/startup/loadingScreen'
import {
  pollServerHealth,
  type StartupResult,
} from './features/startup/pollServerHealth'
import { startupLang, startupText } from './features/startup/startupText'
import { routeTree } from './routeTree.gen'
import DefaultCatchBoundary from './ui/DefaultCatchBoundary'
import { ErrorBoundary } from './ui/error-boundary'
import { captureActivity } from './utils/activity-logger'
import { getServerConfig, restartServer } from './utils/tauri-commands'

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

// Record navigation so the activity log shows which pages/options the operator
// opened — a breadcrumb trail that makes errors far easier to interpret.
// Best-effort: never let logging break navigation.
try {
  router.subscribe('onResolved', (event) => {
    const path = event.toLocation?.pathname
    if (path) captureActivity('navigate', { source: 'router', path })
  })
} catch {
  // Non-fatal — navigation logging is best-effort.
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

const retryDelayMs = isTauriCheck ? 250 : 500

/** Desktop: true once the bundled server failed to start or has exited. */
async function isServerStopped(): Promise<boolean> {
  try {
    return (await getServerConfig()).serverStopped === true
  } catch {
    return false
  }
}

/** Shows a failed start with the one action that moves forward. */
function showStartupFailure(
  result: Exclude<StartupResult, { status: 'ready' }>,
  onRetry: () => void,
): void {
  if (result.status === 'stopped') {
    setLoadingError(
      startupText('errorServerStopped'),
      startupText('restartHint'),
      {
        label: startupText('restart'),
        onClick: () => {
          updateLoadingMessage(startupText('starting'))
          restartServer()
            .catch((error) =>
              captureError(error, { source: 'startup', component: 'router' }),
            )
            .finally(onRetry)
        },
      },
    )
    return
  }
  const title =
    result.status === 'boot_failed'
      ? startupText('errorBootFailed')
      : startupText('errorUnreachable')
  const detail = result.status === 'boot_failed' ? result.message : undefined
  setLoadingError(
    title,
    startupText('retryHint'),
    { label: startupText('retry'), onClick: onRetry },
    detail,
  )
}

/**
 * Desktop startup: the window is up at once; follow the local server's start
 * on the loading page, then mount the app, or show an actionable, reported
 * error. Re-entrant so the error's button can re-run it.
 */
async function runDesktopStartup(): Promise<void> {
  updateLoadingMessage(startupText('starting'))
  logClientTiming('before_getServerConfig')
  const serverConfig = await getServerConfig()
  logClientTiming('after_getServerConfig')
  if (serverConfig) {
    window.__serverConfig = { serverPort: serverConfig.serverPort }
  }

  const apiUrl = getApiUrl() as string
  logClientTiming('before_pollServerHealth')
  const result = await pollServerHealth(apiUrl, {
    fetchFn,
    retryDelayMs,
    isServerStopped,
  })
  logClientTiming('after_pollServerHealth')

  if (result.status === 'ready') {
    hideLoadingScreen()
    mountReact()
    logClientTiming('loading_screen_hidden')
    return
  }

  reportStartupFailure(result, 'desktop')
  showStartupFailure(result, () => void runDesktopStartup())
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

  updateLoadingMessage(startupText('connecting'))
  const result = await pollServerHealth(apiUrl, { fetchFn, retryDelayMs })

  if (result.status === 'ready') {
    hideLoadingScreen()
    mountReact()
    return
  }

  reportStartupFailure(result, 'remote')
  const detail = result.status === 'boot_failed' ? result.message : undefined
  setLoadingError(
    startupText('errorRemote'),
    startupText('retryHint'),
    { label: startupText('retry'), onClick: () => void runMobileStartup() },
    detail,
  )
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
        startupText('errorUnreachable'),
        startupText('retryHint'),
        {
          label: startupText('retry'),
          onClick: () => window.location.reload(),
        },
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
