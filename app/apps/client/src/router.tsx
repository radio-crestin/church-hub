import { createRouter, RouterProvider } from '@tanstack/react-router'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

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
  console.log(
    `[client-startup] ${label}: ${(performance.now() - clientStartTime).toFixed(1)}ms`,
  )
}

logClientTiming('script_loaded')

// Log time since HTML loaded (shows Vite module transformation time)
if (typeof window !== 'undefined' && window.__htmlLoadTime) {
  const moduleLoadTime = performance.now() - window.__htmlLoadTime
  console.log(
    `[client-startup] module_executed (time since HTML): ${moduleLoadTime.toFixed(1)}ms`,
  )
}

// Check Tauri context early
const isTauriCheck =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
logClientTiming(`tauri_check (isTauri=${isTauriCheck})`)

// Loading screen helpers
function updateLoadingStatus(message: string) {
  const statusEl = document.getElementById('loading-status')
  if (statusEl) statusEl.textContent = message
}

let logsInitialized = false
function addLoadingLog(message: string) {
  const logsEl = document.getElementById('loading-logs')
  if (logsEl) {
    // Clear the initial "Initializing..." text on first log
    if (!logsInitialized) {
      logsEl.textContent = ''
      logsInitialized = true
    }
    logsEl.textContent += `${message}\n`
    logsEl.scrollTop = logsEl.scrollHeight
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

// Wait for server to be ready
async function waitForServer(
  apiUrl: string,
  maxAttempts = 60,
): Promise<boolean> {
  const pingUrl = `${apiUrl}/ping`
  const waitStart = performance.now()
  // Shorter delay in Tauri mode since Rust already waited for server
  const retryDelay = isTauriCheck ? 100 : 500

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const attemptStart = performance.now()
      addLoadingLog(
        `[${new Date().toLocaleTimeString()}] Checking server... (attempt ${attempt})`,
      )
      // Use Tauri fetch on mobile to bypass WKWebView HTTP restrictions
      const response = await fetchFn(pingUrl, {
        method: 'GET',
      })

      if (response.ok) {
        const totalTime = (performance.now() - waitStart).toFixed(1)
        const attemptTime = (performance.now() - attemptStart).toFixed(1)
        addLoadingLog(
          `[${new Date().toLocaleTimeString()}] Server is ready! (attempt took ${attemptTime}ms, total wait ${totalTime}ms)`,
        )
        console.log(
          `[client-startup] waitForServer success: attempt=${attempt}, attemptTime=${attemptTime}ms, totalWait=${totalTime}ms`,
        )
        updateLoadingStatus('Server ready, loading app...')
        return true
      }
    } catch (err) {
      // Server not ready yet, continue waiting
      console.log(
        `[client-startup] waitForServer attempt ${attempt} failed:`,
        err,
      )
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }

  addLoadingLog(
    `[${new Date().toLocaleTimeString()}] Server failed to start after ${maxAttempts} attempts`,
  )
  updateLoadingStatus('Failed to connect to server')
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
      addLoadingLog(
        `[${new Date().toLocaleTimeString()}] Church Hub starting...`,
      )
      addLoadingLog(
        `[${new Date().toLocaleTimeString()}] Initializing Tauri context...`,
      )

      // On mobile, we connect to a remote server - skip sidecar logic
      if (isMobile()) {
        logClientTiming('mobile_mode')
        addLoadingLog(
          `[${new Date().toLocaleTimeString()}] Mobile mode detected`,
        )

        // Check if API URL is configured
        if (needsApiUrlConfiguration()) {
          addLoadingLog(
            `[${new Date().toLocaleTimeString()}] API URL not configured - showing setup`,
          )
          hideLoadingScreen()
        } else {
          const apiUrl = getApiUrl()
          if (apiUrl) {
            addLoadingLog(
              `[${new Date().toLocaleTimeString()}] API URL: ${apiUrl}`,
            )
            updateLoadingStatus('Connecting to server...')
            logClientTiming('before_waitForServer')

            const serverReady = await waitForServer(apiUrl, 10)
            logClientTiming('after_waitForServer')

            if (!serverReady) {
              console.error('[router] Failed to connect to remote server')
              addLoadingLog(
                `[${new Date().toLocaleTimeString()}] Failed to connect to server`,
              )
            } else {
              addLoadingLog(
                `[${new Date().toLocaleTimeString()}] Connected! Mounting React application...`,
              )
            }
          }
        }
      } else {
        // Desktop mode: use local sidecar server
        // Get local server config from Tauri (just the port)
        addLoadingLog(
          `[${new Date().toLocaleTimeString()}] Getting server configuration...`,
        )
        logClientTiming('before_getServerConfig')
        const serverConfig = await getServerConfig()
        logClientTiming('after_getServerConfig')

        if (serverConfig) {
          window.__serverConfig = {
            serverPort: serverConfig.serverPort,
          }
          addLoadingLog(
            `[${new Date().toLocaleTimeString()}] Server port: ${serverConfig.serverPort}`,
          )
        }

        // Wait for server to be ready
        // Note: In Tauri mode, Rust already confirmed server is ready before showing webview
        // So this should succeed on first attempt
        updateLoadingStatus('Waiting for server...')
        const apiUrl = getApiUrl()
        addLoadingLog(`[${new Date().toLocaleTimeString()}] API URL: ${apiUrl}`)
        logClientTiming('before_waitForServer')

        // In Tauri mode, Rust already waited for server, so use fewer attempts
        const serverReady = await waitForServer(apiUrl as string, 5) // Only 5 attempts in Tauri (Rust already waited)
        logClientTiming('after_waitForServer')

        if (!serverReady) {
          // biome-ignore lint/suspicious/noConsole: error logging for startup
          console.error('[router] Server failed to start')
        } else {
          addLoadingLog(
            `[${new Date().toLocaleTimeString()}] Mounting React application...`,
          )
        }
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: error logging for startup
      console.error('[router] Error getting server config:', error)
      addLoadingLog(`[${new Date().toLocaleTimeString()}] Error: ${error}`)
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
