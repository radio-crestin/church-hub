import type { SlideStyleOverride } from '~/features/songs/types'
import type { TextStyleRange } from '../types'

/**
 * Turns a slide's persisted per-selection styling into the inline ranges the
 * renderer already knows how to draw.
 *
 * The ids are derived from the offsets rather than random so a re-render never
 * looks like a different set of ranges (AnimatedText compares them by id to
 * decide whether it can skip re-rendering).
 */
export function toTextStyleRanges(
  override?: SlideStyleOverride | null,
): TextStyleRange[] {
  if (!override?.ranges?.length) return []

  return override.ranges.map((range) => ({
    id: `slide-style-${range.start}-${range.end}`,
    start: range.start,
    end: range.end,
    bold: range.bold,
    italic: range.italic,
    underline: range.underline,
    fontScale: range.fontScale,
  }))
}
