import { getDefaultContentConfig } from './default-design/getDefaultContentConfig'
import type { ContentType, ScreenType } from './types'

/**
 * The element each dedicated song layout leaves out of the screen's `song`
 * design: the first slide shows a gama but no amin, the last slide an amin but
 * no gama.
 */
const SONG_SLIDE_LAYOUT_OMITS: Partial<Record<ContentType, string>> = {
  song_first_slide: 'amen',
  song_last_slide: 'songKey',
}

/**
 * The config of a content type a screen has not saved.
 *
 * The first/last song slide layouts follow the screen's own saved `song`
 * design. Screens made before those layouts existed never stored them, and the
 * factory design in their place made a song's first or last slide switch font,
 * size and position mid-song (T-110). Everything else gets the factory design.
 */
export function getMissingContentConfig(
  contentType: ContentType,
  screenType: ScreenType | undefined,
  savedSongConfig: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const omitted = SONG_SLIDE_LAYOUT_OMITS[contentType]
  if (!omitted || !savedSongConfig) {
    return getDefaultContentConfig(contentType, screenType)
  }
  const { [omitted]: _omitted, ...inherited } = savedSongConfig
  return inherited
}
