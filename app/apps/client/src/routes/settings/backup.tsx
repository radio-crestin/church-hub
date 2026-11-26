import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { isLocalhost } from '~/config'
import { BackupManager, CloudBackupPanel } from '~/features/backup'
import {
  SecretStoreResetNotice,
  SecretStoreStatus,
} from '~/features/secret-store'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'
import { CloudSyncSection, SyncSettingsSection } from '~/features/sync'

export const Route = createFileRoute('/settings/backup')({
  component: BackupSettings,
})

function BackupSettings() {
  const { t } = useTranslation('settings')

  return (
    <SettingsLeafGuard itemId="backup">
      <div className="flex min-h-full flex-col gap-6">
        {isLocalhost() && <SecretStoreResetNotice />}
        <SettingsSection
          title={t('sections.backup.title')}
          description={t('sections.backup.description')}
        >
          {isLocalhost() ? (
            <BackupManager />
          ) : (
            <p className="text-sm text-fg-hint">
              {t('sections.backup.localhostOnly')}
            </p>
          )}
        </SettingsSection>
        {isLocalhost() && (
          <SettingsSection
            title={t('sections.backup.cloud.title')}
            description={t('sections.backup.cloud.description')}
          >
            <CloudBackupPanel />
          </SettingsSection>
        )}
        {isLocalhost() && (
          <SettingsSection
            title={t('sections.secretStore.title')}
            description={t('sections.secretStore.description')}
          >
            <SecretStoreStatus />
          </SettingsSection>
        )}
        {isLocalhost() && (
          <SettingsSection
            title={t('sections.cloudSync.title')}
            description={t('sections.cloudSync.description')}
          >
            <CloudSyncSection />
          </SettingsSection>
        )}
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
