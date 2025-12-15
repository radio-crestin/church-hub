import { createRouter, RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import './styles.css'

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

// See vite-env.d.ts to set type
if (typeof window !== 'undefined') {
  // See `vite.config.ts` for all defined values.
  window.__appVersion = __appVersion
  window.__envMode = __envMode

  if (isTauri) {
    try {
      // Get local server config from Tauri (just the port)
      const serverConfig = await getServerConfig()

      if (serverConfig) {
        window.__serverConfig = {
          serverPort: serverConfig.serverPort,
        }
      }
    } catch (error) {
      console.error('[router] Error getting server config:', error)
    }
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}
