import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { isLocalhost } from '~/config'
import { BackupManager } from '~/features/backup'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'
import { SyncSettingsSection } from '~/features/sync'

export const Route = createFileRoute('/settings/backup')({
  component: BackupSettings,
})

function BackupSettings() {
  const { t } = useTranslation('settings')

  return (
    <SettingsLeafGuard itemId="backup">
      <div className="flex min-h-full flex-col gap-6">
        <SettingsSection
          title={t('sections.backup.title')}
          description={t('sections.backup.description')}
        >
          {isLocalhost() ? (
            <BackupManager />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('sections.backup.localhostOnly')}
            </p>
          )}
        </SettingsSection>
        {isLocalhost() && (
          <SettingsSection
            title={t('sections.sync.title')}
            description={t('sections.sync.description')}
          >
            <SyncSettingsSection />
          </SettingsSection>
        )}
      </div>
    </SettingsLeafGuard>
  )
}
