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

// Loading screen helpers
function updateLoadingStatus(message: string) {
  const statusEl = document.getElementById('loading-status')
  if (statusEl) statusEl.textContent = message
}

function addLoadingLog(message: string) {
  const logsEl = document.getElementById('loading-logs')
  if (logsEl) {
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

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      addLoadingLog(
        `[${new Date().toLocaleTimeString()}] Checking server... (attempt ${attempt})`,
      )
      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      })

      if (response.ok) {
        addLoadingLog(`[${new Date().toLocaleTimeString()}] Server is ready!`)
        updateLoadingStatus('Server ready, loading app...')
        return true
      }
    } catch {
      // Server not ready yet, continue waiting
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500))
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
      addLoadingLog(
        `[${new Date().toLocaleTimeString()}] Initializing Tauri...`,
      )

      // Get local server config from Tauri (just the port)
      const serverConfig = await getServerConfig()

      if (serverConfig) {
        window.__serverConfig = {
          serverPort: serverConfig.serverPort,
        }
        addLoadingLog(
          `[${new Date().toLocaleTimeString()}] Server port: ${serverConfig.serverPort}`,
        )
      }

      // Wait for server to be ready
      updateLoadingStatus('Waiting for server...')
      const apiUrl = getApiUrl()
      addLoadingLog(`[${new Date().toLocaleTimeString()}] API URL: ${apiUrl}`)

      const serverReady = await waitForServer(apiUrl)

      if (!serverReady) {
        // biome-ignore lint/suspicious/noConsole: error logging for startup
        console.error('[router] Server failed to start')
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

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)

  // Hide loading screen after React mounts
  if (isTauri) {
    hideLoadingScreen()
  }
}
