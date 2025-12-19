import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import {
  useAutoOpenDisplays,
  useAutoOpenScreens,
} from '~/features/presentation/hooks'
import { PptxDropZoneProvider } from '~/features/song-import'
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
 * Component that handles auto-opening displays and screens
 * Must be inside QueryClientProvider to use hooks
 */
function AutoOpenDisplays() {
  useAutoOpenDisplays()
  useAutoOpenScreens()
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
        <PermissionsProvider>
          <I18nProvider>
            <ToastProvider>
              <PptxDropZoneProvider>
                <AutoOpenDisplays />
                <AppLayout>
                  <Outlet />
                </AppLayout>
              </PptxDropZoneProvider>
              {isDev ? (
                <TanStackRouterDevtools position="bottom-right" />
              ) : null}
            </ToastProvider>
          </I18nProvider>
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
