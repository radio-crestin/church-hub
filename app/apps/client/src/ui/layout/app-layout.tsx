import { useLocation, useSearch } from '@tanstack/react-router'

import {
  useAutoClearHighlights,
  useKeyboardShortcuts,
  useWebSocket,
  WebSocketDebugPanel,
} from '~/features/presentation'
import { WebviewRouteManager } from '~/features/sidebar-config/components/WebviewRouteManager'
import { useDebugMode } from '~/hooks/useDebugMode'
import { Sidebar } from '../sidebar/sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const { isDebugMode } = useDebugMode()
  const { debugInfo } = useWebSocket()

  // Check if running in standalone mode (native window without sidebar)
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const isStandalone =
    search?.standalone === 'true' || search?.standalone === true

  // Enable global keyboard shortcuts for presentation navigation
  useKeyboardShortcuts()

  // Auto-clear highlights when slide changes (works globally)
  useAutoClearHighlights()

  // Full-screen mode for screen/display windows
  if (location.pathname.startsWith('/screen/')) {
    return <>{children}</>
  }

  // Standalone mode - hide sidebar for native page windows
  if (isStandalone) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
        <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50 dark:bg-gray-950 safe-area-right safe-area-bottom overflow-hidden">
          <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-950 p-3 sm:p-4 md:p-6">
            {children}
          </div>
        </main>
        {isDebugMode && <WebSocketDebugPanel debugInfo={debugInfo} />}
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <WebviewRouteManager />
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50 dark:bg-gray-950 md:pt-0 safe-area-right safe-area-bottom mobile-main-content overflow-hidden">
        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-950 p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </main>
      {isDebugMode && <WebSocketDebugPanel debugInfo={debugInfo} />}
    </div>
  )
}
