import { useLocation, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import {
  MobileLiveStrip,
  useAutoClearHighlights,
  useKeyboardShortcuts,
  useWebSocket,
  WebSocketDebugPanel,
} from '~/features/presentation'
import { useLiveProgramNavigation } from '~/features/schedules'
import { WebviewRouteManager } from '~/features/sidebar-config/components/WebviewRouteManager'
import { useDebugMode } from '~/hooks/useDebugMode'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { MobileTabBar } from './mobile-tab-bar'
import { PhoneBottomBarSlotContext } from './phone-bottom-bar'
import { Sidebar } from '../sidebar/sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const { isDebugMode } = useDebugMode()
  const { debugInfo } = useWebSocket()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [phoneBottomBarSlot, setPhoneBottomBarSlot] =
    useState<HTMLElement | null>(null)
  // Tailwind's `md`: the tab bar and live strip are a phone's alone, so a
  // larger window leaves them out of the page instead of only hiding them.
  const isPhone = !useMediaQuery('(min-width: 768px)')

  // Check if running in standalone mode (native window without sidebar)
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const isStandalone =
    search?.standalone === 'true' || search?.standalone === true

  // Enable global keyboard shortcuts for presentation navigation. Pages with
  // no running order of their own still walk a live program.
  const liveProgram = useLiveProgramNavigation()
  useKeyboardShortcuts({ liveProgram })

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
        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col bg-gray-50 dark:bg-gray-950 safe-area-top">
          {/* The top padding is deliberately tighter than the sides: in the
              desktop window the OS title bar already sits above this, so a
              full p-6 up top reads as dead space before the page title. */}
          <div className="p-3 pt-3 sm:p-4 sm:pt-3 md:p-6 md:pt-3 flex-1 lg:min-h-0">
            <PhoneBottomBarSlotContext.Provider value={phoneBottomBarSlot}>
              {children}
            </PhoneBottomBarSlotContext.Provider>
          </div>
        </div>
        {/* Phones: the tab bar and what is live, or the page's own controls
            when it has a PhoneBottomBar (the slot then hides the rest). A
            page keeps its phone layout, and so its bar, up to `lg`; the tab
            bar gives way to the sidebar from `md`. */}
        <div className="group lg:hidden shrink-0">
          <div ref={setPhoneBottomBarSlot} />
          {isPhone && (
            <div className="group-has-[[data-phone-bottom-bar]]:hidden">
              {/* The control room is all about what is live already. */}
              {location.pathname !== '/present' && (
                <MobileLiveStrip liveProgram={liveProgram} />
              )}
              <MobileTabBar onOpenMore={() => setIsMobileMenuOpen(true)} />
            </div>
          )}
        </div>
      </main>
      {isDebugMode && <WebSocketDebugPanel debugInfo={debugInfo} />}
    </div>
  )
}
