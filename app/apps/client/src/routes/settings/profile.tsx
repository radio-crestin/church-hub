import { createFileRoute } from '@tanstack/react-router'

import { AccountSection } from '~/features/auth'
import { SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/profile')({
  component: ProfileSettings,
})

function ProfileSettings() {
  return (
    <SettingsSection>
      <AccountSection />
    </SettingsSection>
  )
}
