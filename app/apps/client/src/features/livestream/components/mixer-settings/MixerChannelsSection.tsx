import { ListOrdered } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Button } from '~/ui/button/Button'
import { useMixerChannels, useMixerConfig } from '../../hooks'
import { NativeSelect } from '../settings-page/NativeSelect'
import { SettingField } from '../settings-page/SettingField'

const CHANNEL_COUNTS = ['8', '16', '24', '32'] as const

/** The mixer's channels and their names, used by the scenes' mute lists. */
export function MixerChannelsSection() {
  const { t } = useTranslation('livestream')
  const { config, update, isUpdating } = useMixerConfig()
  const { channels, update: updateChannels } = useMixerChannels()
  const [channelCount, setChannelCount] = useState(16)
  const [labels, setLabels] = useState<Record<number, string>>({})

  useEffect(() => {
    if (config) setChannelCount(config.channelCount)
  }, [config])

  useEffect(() => {
    setLabels(
      Object.fromEntries(channels.map((c) => [c.channelNumber, c.label])),
    )
  }, [channels])

  if (!config) return null

  const handleSave = () => {
    update({ ...config, channelCount })
    const named = Object.entries(labels)
      .filter(([, label]) => label.trim() !== '')
      .map(([num, label]) => ({
        channelNumber: Number.parseInt(num, 10),
        label: label.trim(),
      }))
    if (named.length > 0) updateChannels(named)
  }

  return (
    <SettingsSection
      title={t('mixer.setup.channelConfiguration')}
      description={t('mixerSettings.channels.description')}
      icon={ListOrdered}
      testId="mixer-settings-channels"
    >
      <SettingField label={t('mixer.setup.channelCount')}>
        {(id) => (
          <NativeSelect
            id={id}
            value={String(channelCount) as (typeof CHANNEL_COUNTS)[number]}
            onChange={(value) => setChannelCount(Number.parseInt(value, 10))}
            options={CHANNEL_COUNTS.map((count) => ({
              value: count,
              label: count,
            }))}
          />
        )}
      </SettingField>
      <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-2">
        {Array.from({ length: channelCount }, (_, i) => i + 1).map((num) => {
          const number = num.toString().padStart(2, '0')
          return (
            <label key={num} className="flex items-center gap-2">
              <span className="w-8 text-right text-xs text-fg-hint tabular-nums">
                {number}
              </span>
              <input
                type="text"
                value={labels[num] ?? ''}
                onChange={(e) =>
                  setLabels((prev) => ({ ...prev, [num]: e.target.value }))
                }
                className="min-w-0 flex-1 rounded-lg bg-field px-2 py-1 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                placeholder={`CH${number}`}
              />
            </label>
          )
        })}
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isUpdating}>
          {t('mixer.setup.save')}
        </Button>
      </div>
    </SettingsSection>
  )
}
