import { createFileRoute } from '@tanstack/react-router'

import { SettingsLayout } from '~/features/settings'

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
})
