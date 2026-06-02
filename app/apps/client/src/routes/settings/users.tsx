import { createFileRoute } from '@tanstack/react-router'

import { SettingsLeafGuard, SettingsSection } from '~/features/settings'
import { UserList } from '~/features/users'

export const Route = createFileRoute('/settings/users')({
  component: UsersSettings,
})

function UsersSettings() {
  return (
    <SettingsLeafGuard itemId="users">
      <SettingsSection>
        <UserList />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
