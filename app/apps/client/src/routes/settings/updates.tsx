import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AutostartSwitch } from '~/features/app-autostart'
import { UpdatePanel } from '~/features/app-update'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'
import { isTauri } from '~/utils/isTauri'

export const Route = createFileRoute('/settings/updates')({
  component: UpdateSettings,
})

function UpdateSettings() {
  const { t } = useTranslation('settings')

  return (
    <SettingsLeafGuard itemId="updates">
      <div className="flex min-h-full flex-col gap-6">
        <SettingsSection
          title={t('sections.updates.title')}
          description={t('sections.updates.description')}
        >
          <UpdatePanel />
        </SettingsSection>
        {isTauri() && (
          <SettingsSection
            title={t('sections.startup.title')}
            description={t('sections.startup.description')}
          >
            <AutostartSwitch />
          </SettingsSection>
        )}
      </div>
    </SettingsLeafGuard>
  )
}
