import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { QueryClientProvider } from '~/provider/QueryClientProvider'
import { ThemeProvider } from '~/provider/theme-provider'
import { AppLayout } from '~/ui/layout/app-layout'

export const Route = createRootRoute({
  component: RootComponent,
})

const isDev = import.meta.env.DEV

function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
        {isDev ? <TanStackRouterDevtools position="bottom-right" /> : null}
      </QueryClientProvider>
    </ThemeProvider>
  )
}
