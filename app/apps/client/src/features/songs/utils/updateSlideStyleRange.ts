import { flattenSlideStyleRanges } from './flattenSlideStyleRanges'
import type { SlideStyleOverride, SlideStyleRange } from '../types'

/**
 * Applies a styling patch to one run of a slide's text.
 *
 * The patch lands on top of whatever the run already carries, word by word: a
 * selection spanning two differently sized runs ends up at one size, and a bold
 * word inside it stays bold. Runs left with no styling are dropped, which is
 * what makes toggling bold off actually remove it rather than storing
 * `bold: false` forever.
 */
export function updateSlideStyleRange(
  override: SlideStyleOverride | null | undefined,
  span: { start: number; end: number },
  patch: Partial<Omit<SlideStyleRange, 'start' | 'end'>>,
): SlideStyleOverride {
  return {
    ...override,
    ranges: flattenSlideStyleRanges([
      ...(override?.ranges ?? []),
      { start: span.start, end: span.end, ...patch },
    ]),
  }
}
