import { createFileRoute } from '@tanstack/react-router'

import { BibleSettingsPanel } from '~/features/bible/components/BibleSettingsPanel'
import { SettingsLeafGuard } from '~/features/settings'

export const Route = createFileRoute('/settings/bible')({
  component: BibleSettings,
})

function BibleSettings() {
  return (
    <SettingsLeafGuard itemId="bible">
      <BibleSettingsPanel />
    </SettingsLeafGuard>
  )
}
