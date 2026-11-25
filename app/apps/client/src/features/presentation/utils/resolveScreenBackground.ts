import type { ContentData } from '../components/rendering/types'
import type {
  ContentType,
  ScreenBackgroundConfig,
  ScreenType,
  ScreenWithConfigs,
} from '../types'

/** Screens that show a song's own background; stage and livestream keep theirs. */
const SONG_BACKGROUND_SCREEN_TYPES: ScreenType[] = ['primary', 'kiosk']

/** The layouts a song slide is drawn with. */
const SONG_CONTENT_TYPES: ContentType[] = [
  'song',
  'song_first_slide',
  'song_last_slide',
]

interface ResolveScreenBackgroundInput {
  screen: Pick<ScreenWithConfigs, 'type' | 'contentConfigs'>
  contentType: ContentType
  contentData: Pick<ContentData, 'songBackground' | 'presentationBackground'>
}

/**
 * The background a screen draws behind the content on it: on a primary or
 * kiosk screen, a presentation's background video behind the steps it covers,
 * or the song's own background while one of its slides is up; else the
 * screen's background for the content type, falling back to its empty one.
 * Undefined when the screen has neither (`ScreenBackground` then draws black).
 */
export function resolveScreenBackground({
  screen,
  contentType,
  contentData,
}: ResolveScreenBackgroundInput): ScreenBackgroundConfig | undefined {
  const onMainScreen = SONG_BACKGROUND_SCREEN_TYPES.includes(screen.type)
  if (contentData.presentationBackground && onMainScreen) {
    return {
      type: 'video',
      videoUrl: contentData.presentationBackground.url,
      color: '#000000',
      opacity: 1,
    }
  }
  if (
    contentData.songBackground &&
    onMainScreen &&
    SONG_CONTENT_TYPES.includes(contentType)
  ) {
    return contentData.songBackground
  }
  return (
    screen.contentConfigs[contentType]?.background ||
    screen.contentConfigs.empty?.background
  )
}
