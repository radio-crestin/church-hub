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
    >
      <OBSConnectionSection />
      <OBSAccessSection />
      <OBSSetupStepsSection />
    </SettingsPageLayout>
  )
}
