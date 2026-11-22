import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Combobox } from '~/ui/combobox/Combobox'
import { Input } from '~/ui/input'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import type { SetSetting, YouTubeSettingsDraft } from './useYouTubeSettingsForm'
import { useVideoCategories } from '../../hooks'
import { SettingField } from '../settings-page/SettingField'
import { SettingFieldRow } from '../settings-page/SettingFieldRow'

interface YouTubeDetailsSectionProps {
  draft: YouTubeSettingsDraft
  set: SetSetting
}

/** What viewers read: title, description (and its chapters), category, tags. */
export function YouTubeDetailsSection({
  draft,
  set,
}: YouTubeDetailsSectionProps) {
  const { t, i18n } = useTranslation('livestream')
  const { categories } = useVideoCategories(i18n.language.slice(0, 2))

  return (
    <SettingsSection
      title={t('youtubeSettings.details.title')}
      description={t('youtubeSettings.details.description')}
      icon={FileText}
      testId="youtube-settings-details"
    >
      <SettingField
        label={t('youtubeSettings.details.streamTitle')}
        description={t('youtubeSettings.details.streamTitleHint')}
      >
        {(id) => (
          <Input
            id={id}
            data-testid="youtube-title"
            value={draft.titleTemplate}
            maxLength={100}
            onChange={(e) => set('titleTemplate', e.target.value)}
          />
        )}
      </SettingField>
      <SettingField
        label={t('youtubeSettings.details.streamDescription')}
        description={t('youtubeSettings.details.streamDescriptionHint')}
      >
        {(id) => (
          <textarea
            id={id}
            data-testid="youtube-description"
            rows={4}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        )}
      </SettingField>
      <SwitchRow
        label={t('youtubeSettings.details.chapters')}
        description={t('youtubeSettings.details.chaptersHint')}
        checked={draft.descriptionChapters}
        onCheckedChange={(checked) => set('descriptionChapters', checked)}
        testId="youtube-description-chapters"
      />
      <SettingFieldRow>
        <SettingField
          label={t('youtubeSettings.details.category')}
          description={t('youtubeSettings.details.categoryHint')}
        >
          {() => (
            <Combobox
              testId="youtube-category"
              options={categories.map((category) => ({
                value: category.id,
                label: category.title,
              }))}
              value={draft.categoryId ?? null}
              onChange={(value) =>
                set('categoryId', value ? String(value) : undefined)
              }
              placeholder={t('youtubeSettings.details.categoryPlaceholder')}
              allowClear
            />
          )}
        </SettingField>
        <SettingField
          label={t('youtubeSettings.details.tags')}
          description={t('youtubeSettings.details.tagsHint')}
        >
          {(id) => (
            <Input
              id={id}
              data-testid="youtube-tags"
              defaultValue={draft.tags.join(', ')}
              key={draft.tags.join(',')}
              onBlur={(e) =>
                set(
                  'tags',
                  e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                )
              }
            />
          )}
        </SettingField>
      </SettingFieldRow>
    </SettingsSection>
  )
}
