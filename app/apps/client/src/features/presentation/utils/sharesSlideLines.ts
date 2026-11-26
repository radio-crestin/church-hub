import { contentFamily } from './contentFamily'
import { diffSlideLines } from './diffSlideLines'
import { resolveScreenBackground } from './resolveScreenBackground'
import type { ContentData } from '../components/rendering/types'
import { normalizeText } from '../components/rendering/utils/normalizeText'
import type { ContentType, ScreenWithConfigs } from '../types'

export interface ShownSlide {
  type: ContentType
  /** The presentation template the slide is drawn with (T-178), if any */
  template?: number | null
  data: Pick<
    ContentData,
    'mainText' | 'songBackground' | 'presentationBackground' | 'styleOverrides'
  >
}

const linesOf = (html: string | undefined) =>
  normalizeText(html ?? '', true).split('\n')

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const backgroundOf = (
  slide: ShownSlide,
  screen: ScreenWithConfigs | null | undefined,
) =>
  screen
    ? resolveScreenBackground({
        screen,
        contentType: slide.type,
        contentData: slide.data,
      })
    : (slide.data.presentationBackground ?? slide.data.songBackground)

/**
 * Whether the next slide can change only what differs from the previous one:
 * the same kind of content (a song's first, middle and last slides are one
 * kind), the same presentation template, the same background on this screen,
 * the same slide styling (style overrides), and main text that keeps or
 * changes in place at least one line.
 * Otherwise the whole slide transitions. The renderer still checks that the
 * text keeps its box, style and size (canMorphText, useLineMorph).
 */
export function sharesSlideLines(
  prev: ShownSlide,
  next: ShownSlide,
  screen: ScreenWithConfigs | null | undefined,
): boolean {
  return (
    contentFamily(prev.type) === contentFamily(next.type) &&
    (prev.template ?? null) === (next.template ?? null) &&
    sameValue(backgroundOf(prev, screen), backgroundOf(next, screen)) &&
    sameValue(prev.data.styleOverrides, next.data.styleOverrides) &&
    diffSlideLines(linesOf(prev.data.mainText), linesOf(next.data.mainText))
      .shared > 0
  )
}
