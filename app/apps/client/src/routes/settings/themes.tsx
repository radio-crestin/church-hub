import { createFileRoute } from '@tanstack/react-router'

import { SettingsLeafGuard } from '~/features/settings'
import { TemplatesPage } from '~/features/slide-templates/components/TemplatesPage'

export const Route = createFileRoute('/settings/themes')({
  component: ThemesSettings,
})

function ThemesSettings() {
  return (
    <SettingsLeafGuard itemId="themes">
      <TemplatesPage />
    </SettingsLeafGuard>
  )
}
