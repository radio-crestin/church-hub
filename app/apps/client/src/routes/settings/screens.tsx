import { createFileRoute } from '@tanstack/react-router'

import { ScreenSettingsPanel } from '~/features/presentation/components/ScreenSettingsPanel'
import { SettingsLeafGuard } from '~/features/settings'

export const Route = createFileRoute('/settings/screens')({
  component: ScreenSettings,
})

function ScreenSettings() {
  return (
    <SettingsLeafGuard itemId="screens">
      <ScreenSettingsPanel />
    </SettingsLeafGuard>
  )
}
