import { createRouter, RouterProvider } from '@tanstack/react-router'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

// Initialize PostHog early for error tracking
import { initPostHog } from './posthog'

initPostHog()

// Initialize global error handlers for unhandled errors and rejections
import { initGlobalErrorHandlers } from './utils/error-handler'

try {
  initGlobalErrorHandlers()
} catch {
  // Silently fail if error handlers can't be initialized (e.g., SSR)
}

import { getApiUrl, isMobile, needsApiUrlConfiguration } from './config'
import { ApiUrlSetup } from './features/api-url-config'
import { routeTree } from './routeTree.gen'
import { getServerConfig } from './utils/tauri-commands'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
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

function updateLoadingMessage(message: string) {
  const el = document.getElementById('loading-message')
  if (el) el.textContent = message
}

function updateLoadingHint(message: string) {
  const el = document.getElementById('loading-hint')
  if (el) el.textContent = message
}

function setLoadingError(message: string, onRetry: () => void): void {
  const screen = document.getElementById('loading-screen')
  if (!screen) return
  const spinner = document.getElementById('loading-spinner')
  if (spinner) spinner.style.display = 'none'
  updateLoadingMessage(message)
  updateLoadingHint('Tap retry below — or fully quit and reopen Church Hub.')
  let retry = document.getElementById(
    'loading-retry',
  ) as HTMLButtonElement | null
  if (!retry) {
    retry = document.createElement('button')
    retry.id = 'loading-retry'
    retry.textContent = 'Retry'
    retry.setAttribute(
      'style',
      'margin-top:16px;padding:10px 20px;border:none;border-radius:8px;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;',
    )
    const content = document.getElementById('loading-content')
    content?.appendChild(retry)
  }
  retry.onclick = () => {
    retry?.setAttribute('disabled', 'true')
    retry?.setAttribute(
      'style',
      `${retry?.getAttribute('style') ?? ''}opacity:0.6;cursor:wait;`,
    )
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

/**
 * Wait for the local sidecar to answer /ping. First-launch boots
 * include the song seed (~1s after our transaction fix) and the FTS
 * rebuild (~3-5s); the Rust side waits for /ping before it shows the
 * webview, but Rust can give up early, so the client needs a generous
 * budget of its own. 30 s = 120 × 250 ms covers worst-case fresh
 * installs on slow disks without making error recovery glacial.
 */
async function waitForServer(
  apiUrl: string,
  maxAttempts = isTauriCheck ? 120 : 60,
): Promise<boolean> {
  const pingUrl = `${apiUrl}/ping`
  const waitStart = performance.now()
  const retryDelay = isTauriCheck ? 250 : 500

  let firstAttemptShown = false

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Per-attempt AbortController — a stale TCP connection that hangs
      // shouldn't burn the whole budget on a single fetch.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      try {
        const response = await fetchFn(pingUrl, {
          method: 'GET',
          signal: controller.signal,
        })
        if (response.ok) {
          const totalTime = (performance.now() - waitStart).toFixed(0)
          // biome-ignore lint/suspicious/noConsole: startup timing logging
          console.log(
            `[client-startup] waitForServer success: attempt=${attempt}, totalWait=${totalTime}ms`,
          )
          return true
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch {
      // not ready yet — fall through to retry
    }

    if (!firstAttemptShown && performance.now() - waitStart > 1500) {
      // Surface a friendly hint once it's clear this isn't an instant
      // boot — fresh installs need time to seed + index.
      updateLoadingHint(
        'Setting things up for the first time — this only happens once.',
      )
      firstAttemptShown = true
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }

  return false
}

// See vite-env.d.ts to set type
if (typeof window !== 'undefined') {
  // See `vite.config.ts` for all defined values.
  window.__appVersion = __appVersion
  window.__envMode = __envMode

  if (isTauri) {
    try {
      logClientTiming('tauri_block_start')
      updateLoadingMessage('Starting Church Hub')

      // On mobile, we connect to a remote server - skip sidecar logic
      if (isMobile()) {
        logClientTiming('mobile_mode')

        // Check if API URL is configured
        if (needsApiUrlConfiguration()) {
          hideLoadingScreen()
        } else {
          const apiUrl = getApiUrl()
          if (apiUrl) {
            updateLoadingMessage('Connecting to server')
            logClientTiming('before_waitForServer')

            const serverReady = await waitForServer(apiUrl)
            logClientTiming('after_waitForServer')

            if (!serverReady) {
              // biome-ignore lint/suspicious/noConsole: error logging for startup
              console.error('[router] Failed to connect to remote server')
              setLoadingError("Couldn't reach the server", () => {
                window.location.reload()
              })
            }
          }
        }
      } else {
        // Desktop mode: use local sidecar server
        logClientTiming('before_getServerConfig')
        const serverConfig = await getServerConfig()
        logClientTiming('after_getServerConfig')

        if (serverConfig) {
          window.__serverConfig = {
            serverPort: serverConfig.serverPort,
          }
        }

        updateLoadingMessage('Getting things ready')
        const apiUrl = getApiUrl()
        logClientTiming('before_waitForServer')

        const serverReady = await waitForServer(apiUrl as string)
        logClientTiming('after_waitForServer')

        if (!serverReady) {
          // biome-ignore lint/suspicious/noConsole: error logging for startup
          console.error('[router] Server failed to start within 30s')
          setLoadingError("Couldn't reach the local server", () => {
            window.location.reload()
          })
        }
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: error logging for startup
      console.error('[router] Error getting server config:', error)
      setLoadingError(`Startup error: ${error}`, () => {
        window.location.reload()
      })
    }
  } else {
    // Not in Tauri, hide loading screen immediately
    hideLoadingScreen()
  }
}

logClientTiming('before_react_mount')

const rootElement = document.getElementById('app')!

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

  return <RouterProvider router={router} />
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  logClientTiming('react_root_created')
  root.render(<App />)
  logClientTiming('react_render_called')

  // Hide loading screen after React mounts
  if (isTauri) {
    hideLoadingScreen()
    logClientTiming('loading_screen_hidden')
  }
}

logClientTiming('script_complete')
