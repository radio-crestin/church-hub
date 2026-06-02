import { createFileRoute } from '@tanstack/react-router'

import { SettingsLeafGuard } from '~/features/settings'
import { SongsSettingsPanel } from '~/features/songs/components/SongsSettingsPanel'

export const Route = createFileRoute('/settings/songs')({
  component: SongsSettings,
})

function SongsSettings() {
  return (
    <SettingsLeafGuard itemId="songs">
      <SongsSettingsPanel />
    </SettingsLeafGuard>
  )
}
