import { ListOrdered, SlidersHorizontal } from 'lucide-react'
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
      sections={[
        {
          id: 'mixer-settings-connection',
          label: t('mixerSettings.connection.title'),
          icon: SlidersHorizontal,
        },
        {
          id: 'mixer-settings-channels',
          label: t('mixer.setup.channelConfiguration'),
          icon: ListOrdered,
        },
      ]}
    >
      <MixerConnectionSection />
      <MixerChannelsSection />
    </SettingsPageLayout>
  )
}
