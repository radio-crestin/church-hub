import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Combobox } from '~/ui/combobox/Combobox'
import { usePastBroadcasts } from '../../hooks'
import { SettingField } from '../settings-page/SettingField'

interface YouTubeTemplateSectionProps {
  selectedBroadcastId?: string
  onPick: (broadcastId: string) => void
  isApplying: boolean
  /** The latest stream filled the settings because none was picked yet. */
  filledFromLatest: boolean
}

/** Pick a past stream: its settings fill the page, to change and save. */
export function YouTubeTemplateSection({
  selectedBroadcastId,
  onPick,
  isApplying,
  filledFromLatest,
}: YouTubeTemplateSectionProps) {
  const { t, i18n } = useTranslation('livestream')
  const { broadcasts, isLoading } = usePastBroadcasts()

  return (
    <SettingsSection
      title={t('youtubeSettings.template.title')}
      description={t('youtubeSettings.template.description')}
      icon={History}
      testId="youtube-settings-template"
    >
      <SettingField label={t('youtubeSettings.template.pick')}>
        {() => (
          <Combobox
            testId="youtube-template-picker"
            options={broadcasts.map((broadcast) => ({
              value: broadcast.broadcastId,
              label: broadcast.title,
              description: new Date(broadcast.completedAt).toLocaleDateString(
                i18n.language,
                { day: 'numeric', month: 'short', year: 'numeric' },
              ),
            }))}
            value={selectedBroadcastId ?? null}
            onChange={(value) => value && onPick(String(value))}
            placeholder={
              isLoading
                ? t('youtubeSettings.loading')
                : broadcasts.length
                  ? t('youtubeSettings.template.placeholder')
                  : t('youtubeSettings.template.none')
            }
            disabled={isApplying || !broadcasts.length}
            allowClear={false}
          />
        )}
      </SettingField>
      {filledFromLatest && (
        <p
          data-testid="youtube-template-latest-hint"
          className="mt-1 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
        >
          {t('youtubeSettings.template.filledFromLatest')}
        </p>
      )}
    </SettingsSection>
  )
}
