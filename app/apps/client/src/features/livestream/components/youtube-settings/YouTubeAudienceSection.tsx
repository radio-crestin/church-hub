import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import type { SetSetting, YouTubeSettingsDraft } from './useYouTubeSettingsForm'
import { NativeSelect } from '../settings-page/NativeSelect'
import { SettingField } from '../settings-page/SettingField'

interface YouTubeAudienceSectionProps {
  draft: YouTubeSettingsDraft
  set: SetSetting
}

/** Who can watch: privacy and the made-for-kids declaration. */
export function YouTubeAudienceSection({
  draft,
  set,
}: YouTubeAudienceSectionProps) {
  const { t } = useTranslation('livestream')

  return (
    <SettingsSection
      title={t('youtubeSettings.audience.title')}
      description={t('youtubeSettings.audience.description')}
      icon={Users}
      testId="youtube-settings-audience"
    >
      <SettingField
        label={t('youtubeSettings.audience.privacy')}
        description={t(
          `youtubeSettings.audience.privacyHint.${draft.privacyStatus}`,
        )}
      >
        {(id) => (
          <NativeSelect
            id={id}
            testId="youtube-privacy"
            value={draft.privacyStatus}
            onChange={(value) => set('privacyStatus', value)}
            options={[
              { value: 'public', label: t('youtube.privacyPublic') },
              { value: 'unlisted', label: t('youtube.privacyUnlisted') },
              { value: 'private', label: t('youtube.privacyPrivate') },
            ]}
          />
        )}
      </SettingField>
      <SwitchRow
        label={t('youtubeSettings.audience.madeForKids')}
        description={t('youtubeSettings.audience.madeForKidsHint')}
        checked={draft.madeForKids}
        onCheckedChange={(checked) => set('madeForKids', checked)}
        testId="youtube-made-for-kids"
      />
    </SettingsSection>
  )
}
