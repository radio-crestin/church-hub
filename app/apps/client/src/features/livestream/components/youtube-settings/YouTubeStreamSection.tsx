import { Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Combobox } from '~/ui/combobox/Combobox'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import type { SetSetting, YouTubeSettingsDraft } from './useYouTubeSettingsForm'
import { useStreamKeys } from '../../hooks'
import { NativeSelect } from '../settings-page/NativeSelect'
import { SettingField } from '../settings-page/SettingField'

interface YouTubeStreamSectionProps {
  draft: YouTubeSettingsDraft
  set: SetSetting
}

/** How the stream runs: stream key, latency, DVR, auto-start and auto-stop. */
export function YouTubeStreamSection({
  draft,
  set,
}: YouTubeStreamSectionProps) {
  const { t } = useTranslation('livestream')
  const { data: streamKeys = [] } = useStreamKeys()

  return (
    <SettingsSection
      title={t('youtubeSettings.stream.title')}
      description={t('youtubeSettings.stream.description')}
      icon={Radio}
      testId="youtube-settings-stream"
    >
      <SettingField
        label={t('youtubeSettings.stream.streamKey')}
        description={t('youtubeSettings.stream.streamKeyHint')}
      >
        {() => (
          <Combobox
            testId="youtube-stream-key"
            options={streamKeys.map((key) => ({
              value: key.id,
              label: key.name,
            }))}
            value={draft.streamKeyId ?? null}
            onChange={(value) =>
              set('streamKeyId', value ? String(value) : undefined)
            }
            placeholder={t('youtube.selectStreamKey')}
            allowClear={false}
          />
        )}
      </SettingField>
      <SettingField
        label={t('youtubeSettings.stream.latency')}
        description={t(
          `youtubeSettings.stream.latencyHint.${draft.latencyPreference}`,
        )}
      >
        {(id) => (
          <NativeSelect
            id={id}
            testId="youtube-latency"
            value={draft.latencyPreference}
            onChange={(value) => set('latencyPreference', value)}
            options={[
              {
                value: 'normal',
                label: t('youtubeSettings.stream.latencyNormal'),
              },
              { value: 'low', label: t('youtubeSettings.stream.latencyLow') },
              {
                value: 'ultraLow',
                label: t('youtubeSettings.stream.latencyUltraLow'),
              },
            ]}
          />
        )}
      </SettingField>
      <SwitchRow
        label={t('youtubeSettings.stream.dvr')}
        description={t('youtubeSettings.stream.dvrHint')}
        checked={draft.enableDvr}
        onCheckedChange={(checked) => set('enableDvr', checked)}
        testId="youtube-dvr"
      />
      <SwitchRow
        label={t('youtubeSettings.stream.autoStart')}
        description={t('youtubeSettings.stream.autoStartHint')}
        checked={draft.enableAutoStart}
        onCheckedChange={(checked) => set('enableAutoStart', checked)}
        testId="youtube-auto-start"
      />
      <SwitchRow
        label={t('youtubeSettings.stream.autoStop')}
        description={t('youtubeSettings.stream.autoStopHint')}
        checked={draft.enableAutoStop}
        onCheckedChange={(checked) => set('enableAutoStop', checked)}
        testId="youtube-auto-stop"
      />
    </SettingsSection>
  )
}
