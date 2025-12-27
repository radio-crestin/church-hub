import { createFileRoute, redirect } from '@tanstack/react-router'

import { getKioskSettingsSync } from '~/features/kiosk'

export const Route = createFileRoute('/(root)/')({
  beforeLoad: () => {
    // Synchronous read from localStorage - no await needed
    const settings = getKioskSettingsSync()

    if (settings.enabled) {
      if (settings.startupPage.type === 'screen') {
        throw redirect({ to: `/screen/${settings.startupPage.screenId}` })
      } else if (settings.startupPage.path) {
        throw redirect({ to: settings.startupPage.path })
      }
    }

    // Default redirect to /present
    throw redirect({ to: '/present' })
  },
})
