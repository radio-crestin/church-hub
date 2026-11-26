import { createFileRoute } from '@tanstack/react-router'
import { LibraryBig } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsLeafGuard, SettingsSection } from '~/features/settings'
import { CuratorPanel } from '~/features/song-library'

export const Route = createFileRoute('/settings/song-library')({
  component: SongLibrarySettings,
})

function SongLibrarySettings() {
  const { t } = useTranslation('songLibrary')
  return (
    <SettingsLeafGuard itemId="song-library">
      <SettingsSection
        title={t('curator.title')}
        description={t('curator.description')}
        icon={LibraryBig}
        testId="song-library-settings"
      >
        <CuratorPanel />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
