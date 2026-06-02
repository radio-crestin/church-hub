import { createFileRoute } from '@tanstack/react-router'

import { ApiUrlSettings } from '~/features/api-url-config'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/connection')({
  component: ConnectionSettings,
})

function ConnectionSettings() {
  return (
    <SettingsLeafGuard itemId="connection">
      <SettingsSection>
        <ApiUrlSettings />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
