import { createFileRoute, redirect } from '@tanstack/react-router'

import { fetchKioskSettings } from '~/features/kiosk'

export const Route = createFileRoute('/(root)/')({
  beforeLoad: async () => {
    try {
      const settings = await fetchKioskSettings()

      if (settings.enabled) {
        if (settings.startupPage.type === 'screen') {
          throw redirect({ to: `/screen/${settings.startupPage.screenId}` })
        } else if (settings.startupPage.path) {
          throw redirect({ to: settings.startupPage.path })
        }
      }
    } catch (error) {
      // If it's a redirect, re-throw it
      if (
        error instanceof Response ||
        (error && typeof error === 'object' && 'to' in error)
      ) {
        throw error
      }
      // Otherwise log and fall through to default - ignore console for error logging
    }

    // Default redirect to /present
    throw redirect({ to: '/present' })
  },
})
