import type { TextStyleRange } from '../types'

/**
 * Moves style ranges `by` characters later, for a screen that draws text in
 * front of the text the ranges were counted in. Returns the same array when
 * there is nothing to move, so memoised renderers see no change.
 */
export function offsetStyleRanges(
  ranges: TextStyleRange[] | undefined,
  by: number,
): TextStyleRange[] | undefined {
  if (!ranges || ranges.length === 0 || by === 0) return ranges
  return ranges.map((range) => ({
    ...range,
    start: range.start + by,
    end: range.end + by,
  }))
}
