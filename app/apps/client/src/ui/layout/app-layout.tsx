import { useLocation } from '@tanstack/react-router'

import {
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

  // Enable global keyboard shortcuts for presentation navigation
  useKeyboardShortcuts()

  // Full-screen mode for screen/display windows
  if (location.pathname.startsWith('/screen/')) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <WebviewRouteManager />
      <Sidebar />
      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable] scrollbar-thin bg-gray-50 dark:bg-gray-950 md:pt-0 safe-area-right safe-area-bottom mobile-main-content">
        <div className="p-4 md:p-6 h-full">{children}</div>
      </main>
      {isDebugMode && <WebSocketDebugPanel debugInfo={debugInfo} />}
    </div>
  )
}
