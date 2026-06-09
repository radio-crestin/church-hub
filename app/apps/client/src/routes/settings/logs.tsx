import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { LogsPanel } from '~/features/logs'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/logs')({
  component: LogsSettings,
})

function LogsSettings() {
  const { t } = useTranslation('settings')

  return (
    <SettingsLeafGuard itemId="logs">
      <SettingsSection
        title={t('sections.logs.title')}
        description={t('sections.logs.description')}
      >
        <LogsPanel />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
