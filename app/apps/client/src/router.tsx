import { createRouter, RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import './styles.css'

import { getApiUrl } from './config'
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

// Startup timing
const clientStartTime = performance.now()
const logClientTiming = (label: string) => {
  console.log(`[client-startup] ${label}: ${(performance.now() - clientStartTime).toFixed(1)}ms`)
}

logClientTiming('script_loaded')

// Log time since HTML loaded (shows Vite module transformation time)
if (typeof window !== 'undefined' && window.__htmlLoadTime) {
  const moduleLoadTime = performance.now() - window.__htmlLoadTime
  console.log(`[client-startup] module_executed (time since HTML): ${moduleLoadTime.toFixed(1)}ms`)
}

// Check Tauri context early
const isTauriCheck = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
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
      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(isTauriCheck ? 500 : 2000), // Shorter timeout in Tauri
      })

      if (response.ok) {
        const totalTime = (performance.now() - waitStart).toFixed(1)
        const attemptTime = (performance.now() - attemptStart).toFixed(1)
        addLoadingLog(`[${new Date().toLocaleTimeString()}] Server is ready! (attempt took ${attemptTime}ms, total wait ${totalTime}ms)`)
        console.log(`[client-startup] waitForServer success: attempt=${attempt}, attemptTime=${attemptTime}ms, totalWait=${totalTime}ms`)
        updateLoadingStatus('Server ready, loading app...')
        return true
      }
    } catch (err) {
      // Server not ready yet, continue waiting
      console.log(`[client-startup] waitForServer attempt ${attempt} failed:`, err)
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
      addLoadingLog(`[${new Date().toLocaleTimeString()}] Church Hub starting...`)
      addLoadingLog(`[${new Date().toLocaleTimeString()}] Initializing Tauri context...`)

      // Get local server config from Tauri (just the port)
      addLoadingLog(`[${new Date().toLocaleTimeString()}] Getting server configuration...`)
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
      const serverReady = await waitForServer(apiUrl, 5) // Only 5 attempts in Tauri (Rust already waited)
      logClientTiming('after_waitForServer')

      if (!serverReady) {
        // biome-ignore lint/suspicious/noConsole: error logging for startup
        console.error('[router] Server failed to start')
      } else {
        addLoadingLog(`[${new Date().toLocaleTimeString()}] Mounting React application...`)
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

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  logClientTiming('react_root_created')
  root.render(<RouterProvider router={router} />)
  logClientTiming('react_render_called')

  // Hide loading screen after React mounts
  if (isTauri) {
    hideLoadingScreen()
    logClientTiming('loading_screen_hidden')
  }
}

logClientTiming('script_complete')
