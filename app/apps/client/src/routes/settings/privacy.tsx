import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PrivacyPolicy, UsageDataToggle } from '~/features/analytics'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/privacy')({
  component: PrivacySettings,
})

function PrivacySettings() {
  const { t } = useTranslation('privacy')
  return (
    <SettingsLeafGuard itemId="privacy">
      <div className="space-y-6">
        <SettingsSection title={t('title')} description={t('description')}>
          <UsageDataToggle />
        </SettingsSection>
        <SettingsSection title={t('policy.title')}>
          <PrivacyPolicy />
        </SettingsSection>
      </div>
    </SettingsLeafGuard>
  )
}
