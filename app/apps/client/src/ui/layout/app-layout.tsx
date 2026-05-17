import { useLocation, useSearch } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { t } = useTranslation('sidebar')

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
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuChange={setIsMobileMenuOpen}
      />
      <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50 dark:bg-gray-950 safe-area-right safe-area-bottom overflow-hidden">
        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col bg-gray-50 dark:bg-gray-950">
          {/* Mobile Header - inside scroll area so it scrolls away */}
          <header className="shrink-0 md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 safe-area-top safe-area-left safe-area-right">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <img src="/logo192.png" alt="Church Hub" className="w-8 h-8" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Church Hub
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={t('actions.openMenu')}
              >
                <Menu size={24} />
              </button>
            </div>
          </header>
          <div className="p-3 pb-16 sm:p-4 sm:pb-16 md:p-6 md:pb-6 flex-1 lg:min-h-0">
            {children}
          </div>
        </div>
      </main>
      {isDebugMode && <WebSocketDebugPanel debugInfo={debugInfo} />}
    </div>
  )
}
