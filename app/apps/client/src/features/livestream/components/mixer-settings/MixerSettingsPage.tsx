import { useTranslation } from 'react-i18next'

import { MixerChannelsSection } from './MixerChannelsSection'
import { MixerConnectionSection } from './MixerConnectionSection'
import { SettingsPageLayout } from '../settings-page/SettingsPageLayout'

/** The audio mixer Church Hub mutes and unmutes with the scenes. */
export function MixerSettingsPage() {
  const { t } = useTranslation('livestream')

  return (
    <SettingsPageLayout
      title={t('mixerSettings.title')}
      description={t('mixerSettings.subtitle')}
      testId="mixer-settings-page"
    >
      <MixerConnectionSection />
      <MixerChannelsSection />
    </SettingsPageLayout>
  )
}
