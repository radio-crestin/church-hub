import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { useAutoOpenDisplays } from '~/features/presentation/hooks'
import { PptxDropZoneProvider } from '~/features/song-import'
import { I18nProvider } from '~/provider/i18n-provider'
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
 * Component that handles auto-opening displays
 * Must be inside QueryClientProvider to use hooks
 */
function AutoOpenDisplays() {
  useAutoOpenDisplays()
  return null
}

function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider>
        <I18nProvider>
          <ToastProvider>
            <PptxDropZoneProvider>
              <AutoOpenDisplays />
              <AppLayout>
                <Outlet />
              </AppLayout>
            </PptxDropZoneProvider>
            {isDev ? <TanStackRouterDevtools position="bottom-right" /> : null}
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
