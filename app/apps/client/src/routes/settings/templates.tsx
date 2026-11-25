import { createFileRoute } from '@tanstack/react-router'

import { SettingsLeafGuard } from '~/features/settings'
import { TemplatesPage } from '~/features/slide-templates/components/TemplatesPage'

export const Route = createFileRoute('/settings/templates')({
  component: TemplatesSettings,
})

function TemplatesSettings() {
  return (
    <SettingsLeafGuard itemId="templates">
      <TemplatesPage />
    </SettingsLeafGuard>
  )
}
