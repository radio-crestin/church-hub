import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SearchEngineSettings } from '~/features/search-engine'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/search-engine')({
  component: SearchEngineSettingsPage,
})

function SearchEngineSettingsPage() {
  const { t } = useTranslation('settings')

  return (
    <SettingsLeafGuard itemId="search-engine">
      <SettingsSection
        title={t('sections.searchEngine.title')}
        description={t('sections.searchEngine.description')}
      >
        <SearchEngineSettings />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
