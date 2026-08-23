import type { SlideStyleOverride } from '~/features/songs/types'
import { flattenSlideStyleRanges } from '~/features/songs/utils/flattenSlideStyleRanges'
import type { TextStyleRange } from '../types'

/**
 * Turns a slide's persisted per-selection styling into the inline ranges the
 * renderer already knows how to draw.
 *
 * The ids are derived from the offsets rather than random so a re-render never
 * looks like a different set of ranges (AnimatedText compares them by id to
 * decide whether it can skip re-rendering).
 *
 * Runs are flattened first: a slide styled before ranges stopped overlapping
 * still holds runs stacked on top of each other, and drawn as nested markup
 * their sizes multiply into something nobody asked for.
 */
export function toTextStyleRanges(
  override?: SlideStyleOverride | null,
): TextStyleRange[] {
  if (!override?.ranges?.length) return []

  return flattenSlideStyleRanges(override.ranges).map((range) => ({
    id: `slide-style-${range.start}-${range.end}`,
    start: range.start,
    end: range.end,
    bold: range.bold,
    italic: range.italic,
    underline: range.underline,
    fontScale: range.fontScale,
  }))
}
