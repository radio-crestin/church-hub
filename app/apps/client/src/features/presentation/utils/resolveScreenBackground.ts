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
  contentData: Pick<ContentData, 'songBackground'>
}

/**
 * The background a screen draws behind the content on it: the song's own
 * background while one of its slides is on a primary or kiosk screen, else the
 * screen's background for the content type, falling back to its empty one.
 * Undefined when the screen has neither (`ScreenBackground` then draws black).
 */
export function resolveScreenBackground({
  screen,
  contentType,
  contentData,
}: ResolveScreenBackgroundInput): ScreenBackgroundConfig | undefined {
  if (
    contentData.songBackground &&
    SONG_BACKGROUND_SCREEN_TYPES.includes(screen.type) &&
    SONG_CONTENT_TYPES.includes(contentType)
  ) {
    return contentData.songBackground
  }
  return (
    screen.contentConfigs[contentType]?.background ||
    screen.contentConfigs.empty?.background
  )
}
