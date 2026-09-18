import { useTranslation } from 'react-i18next'

import type { ContentType } from '../../types'

// A song is drawn with three layouts, each with its own background.
const SONG_CONTENT_TYPES: ContentType[] = [
  'song',
  'song_first_slide',
  'song_last_slide',
]

interface BackgroundSongTypesHintProps {
  contentType: ContentType
}

/**
 * Reminds the operator, on a song layout, that the other two song layouts
 * keep backgrounds of their own. Renders nothing for other content types.
 */
export function BackgroundSongTypesHint({
  contentType,
}: BackgroundSongTypesHintProps) {
  const { t } = useTranslation('presentation')

  if (!SONG_CONTENT_TYPES.includes(contentType)) return null

  return (
    <p
      data-testid="background-song-types-hint"
      className="text-xs text-gray-500 dark:text-gray-400"
    >
      {t('screens.background.songTypesHint', {
        song: t('screens.contentTypes.song'),
        firstSlide: t('screens.contentTypes.song_first_slide'),
        lastSlide: t('screens.contentTypes.song_last_slide'),
      })}
    </p>
  )
}
