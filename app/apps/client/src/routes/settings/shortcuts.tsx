import { createFileRoute } from '@tanstack/react-router'

import { AppShortcutsPanel } from '~/features/keyboard-shortcuts'
import { SettingsLeafGuard } from '~/features/settings'

export const Route = createFileRoute('/settings/shortcuts')({
  component: ShortcutsSettings,
})

function ShortcutsSettings() {
  return (
    <SettingsLeafGuard itemId="shortcuts">
      <AppShortcutsPanel />
    </SettingsLeafGuard>
  )
}
