import { createFileRoute } from '@tanstack/react-router'

import { SettingsLeafGuard, SettingsSection } from '~/features/settings'
import { SidebarConfigManager } from '~/features/sidebar-config'

export const Route = createFileRoute('/settings/sidebar')({
  component: SidebarSettings,
})

function SidebarSettings() {
  return (
    <SettingsLeafGuard itemId="sidebar">
      <SettingsSection>
        <SidebarConfigManager />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
