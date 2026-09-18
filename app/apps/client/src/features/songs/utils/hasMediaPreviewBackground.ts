import type {
  ContentType,
  ScreenBackgroundConfig,
  ScreenWithConfigs,
} from '~/features/presentation/types'
import { resolveScreenBackground } from '~/features/presentation/utils/resolveScreenBackground'

/** The layouts a song slide is drawn with (first, middle and last slides). */
const SONG_CONTENT_TYPES: ContentType[] = [
  'song',
  'song_first_slide',
  'song_last_slide',
]

/**
 * Whether any slide of a song draws an image or a video behind its lyrics on
 * the preview screen — the song's own background where that screen shows it,
 * else the screen's song backgrounds. Only then is there something to hide
 * from the song page's previews. An image or video without a file draws just
 * its base colour, so it does not count.
 */
export function hasMediaPreviewBackground(
  screen: Pick<ScreenWithConfigs, 'type' | 'contentConfigs'> | undefined,
  songBackground: ScreenBackgroundConfig | null,
): boolean {
  if (!screen) return false
  return SONG_CONTENT_TYPES.some((contentType) => {
    const background = resolveScreenBackground({
      screen,
      contentType,
      contentData: { songBackground },
    })
    return (
      (background?.type === 'image' && Boolean(background.imageUrl)) ||
      (background?.type === 'video' && Boolean(background.videoUrl))
    )
  })
}
