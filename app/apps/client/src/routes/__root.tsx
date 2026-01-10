import {
  createRootRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect } from 'react'

import { isTauri } from '~/config'
import { MobileConnectionGuard } from '~/features/api-url-config'
import {
  GlobalAppShortcutManager,
  KeyboardNavigationProvider,
  MIDISettingsProvider,
  ShortcutRecordingProvider,
} from '~/features/keyboard-shortcuts'
import {
  KioskFullscreenManager,
  KioskScreenDimManager,
  KioskWakeLockManager,
} from '~/features/kiosk'
import { useAutoOpenScreens } from '~/features/presentation/hooks'
import { FileDropZoneProvider } from '~/features/song-import'
import { I18nProvider } from '~/provider/i18n-provider'
import { PermissionsProvider } from '~/provider/permissions-provider'
import { QueryClientProvider } from '~/provider/QueryClientProvider'
import { ThemeProvider } from '~/provider/theme-provider'
import { AppLayout } from '~/ui/layout/app-layout'
import { ToastProvider } from '~/ui/toast'

// Initialize i18n
import '~/i18n/config'

export const Route = createRootRoute({
  component: RootComponent,
})

const isDev = import.meta.env.DEV

/**
 * Component that handles auto-opening screens
 * Must be inside QueryClientProvider to use hooks
 */
function AutoOpenScreens() {
  useAutoOpenScreens()
  return null
}

/**
 * Component that listens for sidebar navigation events from MIDI shortcuts
 * Only active in Tauri desktop window
 */
function SidebarNavigationListener() {
  const navigate = useNavigate()

  useEffect(() => {
    // Only listen in Tauri desktop context
    if (!isTauri()) return

    function handleSidebarNavigation(
      event: CustomEvent<{ route: string; focusSearch: boolean }>,
    ) {
      const { route, focusSearch } = event.detail
      navigate({
        to: route,
        search: focusSearch ? { focus: 'true' } : undefined,
      })
    }

    window.addEventListener(
      'sidebar-navigation',
      handleSidebarNavigation as EventListener,
    )

    return () => {
      window.removeEventListener(
        'sidebar-navigation',
        handleSidebarNavigation as EventListener,
      )
    }
  }, [navigate])

  return null
}

/**
 * Minimal layout for screen routes (display windows)
 * Only includes essential providers for rendering
 */
function ScreenLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider>
        <KioskWakeLockManager />
        <KioskFullscreenManager />
        <KioskScreenDimManager />
        <Outlet />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

/**
 * Full layout for main app routes
 */
function MainLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider>
        <KioskWakeLockManager />
        <KioskFullscreenManager />
        <KioskScreenDimManager />
        <PermissionsProvider>
          <MobileConnectionGuard>
            <I18nProvider>
              <ToastProvider>
                <KeyboardNavigationProvider>
                  <MIDISettingsProvider>
                    <ShortcutRecordingProvider>
                      <FileDropZoneProvider>
                        <AutoOpenScreens />
                        <SidebarNavigationListener />
                        <GlobalAppShortcutManager />
                        <AppLayout>
                          <Outlet />
                        </AppLayout>
                      </FileDropZoneProvider>
                    </ShortcutRecordingProvider>
                  </MIDISettingsProvider>
                </KeyboardNavigationProvider>
                {isDev ? (
                  <TanStackRouterDevtools position="bottom-right" />
                ) : null}
              </ToastProvider>
            </I18nProvider>
          </MobileConnectionGuard>
        </PermissionsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function RootComponent() {
  const location = useLocation()

  // Use minimal layout for screen routes (display windows)
  if (location.pathname.startsWith('/screen/')) {
    return <ScreenLayout />
  }

  return <MainLayout />
}
