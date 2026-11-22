import { KeyRound, ListChecks, PlugZap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { OBSAccessSection } from './OBSAccessSection'
import { OBSConnectionSection } from './OBSConnectionSection'
import { OBSSetupStepsSection } from './OBSSetupStepsSection'
import { SettingsPageLayout } from '../settings-page/SettingsPageLayout'

/** How Church Hub reaches OBS Studio. */
export function OBSSettingsPage() {
  const { t } = useTranslation('livestream')

  return (
    <SettingsPageLayout
      title={t('obsSettings.title')}
      description={t('obsSettings.subtitle')}
      testId="obs-settings-page"
      sections={[
        {
          id: 'obs-settings-connection',
          label: t('obsSettings.connection.title'),
          icon: PlugZap,
        },
        {
          id: 'obs-settings-access',
          label: t('obsSettings.access.title'),
          icon: KeyRound,
        },
        {
          id: 'obs-settings-steps',
          label: t('obsSettings.steps.title'),
          icon: ListChecks,
        },
      ]}
    >
      <OBSConnectionSection />
      <OBSAccessSection />
      <OBSSetupStepsSection />
    </SettingsPageLayout>
  )
}
