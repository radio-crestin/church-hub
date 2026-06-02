import { createFileRoute } from '@tanstack/react-router'

import { KioskSettingsSection } from '~/features/kiosk'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/kiosk')({
  component: KioskSettings,
})

function KioskSettings() {
  return (
    <SettingsLeafGuard itemId="kiosk">
      <SettingsSection>
        <KioskSettingsSection />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
