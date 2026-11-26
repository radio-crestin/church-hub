import { ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Button } from '~/ui/button/Button'
import { Combobox } from '~/ui/combobox/Combobox'
import type { SetSetting, YouTubeSettingsDraft } from './useYouTubeSettingsForm'
import { useYoutubePlaylists } from '../../hooks'
import { SettingField } from '../settings-page/SettingField'

interface YouTubeExtrasSectionProps {
  draft: YouTubeSettingsDraft
  set: SetSetting
}

/** The thumbnail (from the template) and the playlist new streams join. */
export function YouTubeExtrasSection({
  draft,
  set,
}: YouTubeExtrasSectionProps) {
  const { t } = useTranslation('livestream')
  const { playlists } = useYoutubePlaylists()

  return (
    <SettingsSection
      title={t('youtubeSettings.extras.title')}
      description={t('youtubeSettings.extras.description')}
      icon={ImageIcon}
      testId="youtube-settings-extras"
    >
      <SettingField
        label={t('youtubeSettings.extras.thumbnail')}
        description={t('youtubeSettings.extras.thumbnailHint')}
      >
        {() =>
          draft.thumbnailUrl ? (
            <div className="flex flex-wrap items-end gap-3">
              <img
                src={draft.thumbnailUrl}
                alt={t('youtubeSettings.extras.thumbnail')}
                data-testid="youtube-thumbnail"
                className="aspect-video w-48 rounded-lg border border-line object-cover"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => set('thumbnailUrl', undefined)}
              >
                {t('youtubeSettings.extras.thumbnailRemove')}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-fg-hint">
              {t('youtubeSettings.extras.thumbnailNone')}
            </p>
          )
        }
      </SettingField>
      <SettingField
        label={t('youtubeSettings.extras.playlist')}
        description={t('youtubeSettings.extras.playlistHint')}
      >
        {() => (
          <Combobox
            testId="youtube-playlist"
            options={playlists.map((playlist) => ({
              value: playlist.id,
              label: playlist.title,
            }))}
            value={draft.playlistId ?? null}
            onChange={(value) =>
              set('playlistId', value ? String(value) : undefined)
            }
            placeholder={t('youtube.setup.selectPlaylist')}
            allowClear
          />
        )}
      </SettingField>
    </SettingsSection>
  )
}
