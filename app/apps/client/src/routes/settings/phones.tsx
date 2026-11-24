import { createFileRoute } from '@tanstack/react-router'
import { Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ConnectPhone } from '~/features/phone-pairing'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/phones')({
  component: PhonesSettings,
})

function PhonesSettings() {
  const { t } = useTranslation('settings')
  return (
    <SettingsLeafGuard itemId="phones">
      <SettingsSection
        title={t('sections.phones.title')}
        description={t('sections.phones.description')}
        icon={Smartphone}
      >
        <ConnectPhone />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
