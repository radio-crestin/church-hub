import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { I18nProvider } from '~/provider/i18n-provider'
import { QueryClientProvider } from '~/provider/QueryClientProvider'
import { ThemeProvider } from '~/provider/theme-provider'
import { AppLayout } from '~/ui/layout/app-layout'

// Initialize i18n
import '~/i18n/config'

export const Route = createRootRoute({
  component: RootComponent,
})

const isDev = import.meta.env.DEV

function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider>
        <I18nProvider>
          <AppLayout>
            <Outlet />
          </AppLayout>
          {isDev ? <TanStackRouterDevtools position="bottom-right" /> : null}
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
