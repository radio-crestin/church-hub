import { diffSlideLines } from './diffSlideLines'
import type { ContentData } from '../components/rendering/types'
import { normalizeText } from '../components/rendering/utils/normalizeText'
import type { ContentType } from '../types'

export interface ShownSlide {
  type: ContentType
  data: Pick<ContentData, 'mainText' | 'songBackground' | 'styleOverrides'>
}

const linesOf = (html: string | undefined) =>
  normalizeText(html ?? '', true).split('\n')

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Whether the next slide can change only the lines it doesn't share with the
 * previous one: same layout (content type), same background, same slide
 * template (style overrides), and at least one line of main text in common.
 * Otherwise the whole slide transitions.
 */
export function sharesSlideLines(prev: ShownSlide, next: ShownSlide): boolean {
  return (
    prev.type === next.type &&
    sameValue(prev.data.songBackground, next.data.songBackground) &&
    sameValue(prev.data.styleOverrides, next.data.styleOverrides) &&
    diffSlideLines(linesOf(prev.data.mainText), linesOf(next.data.mainText))
      .shared > 0
  )
}
