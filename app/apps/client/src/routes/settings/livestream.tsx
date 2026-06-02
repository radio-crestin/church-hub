import { createFileRoute } from '@tanstack/react-router'

import { LivestreamSettingsPanel } from '~/features/livestream/components/LivestreamSettingsPanel'
import { SettingsLeafGuard } from '~/features/settings'

export const Route = createFileRoute('/settings/livestream')({
  component: LivestreamSettings,
})

function LivestreamSettings() {
  return (
    <SettingsLeafGuard itemId="livestream">
      <LivestreamSettingsPanel />
    </SettingsLeafGuard>
  )
}
