import type { SlideStyleRange } from '../types'

type RangeStyle = Omit<SlideStyleRange, 'start' | 'end'>

const STYLE_KEYS = ['bold', 'italic', 'underline', 'fontScale'] as const

/**
 * Rewrites a slide's styled runs as a sorted list that never overlaps.
 *
 * Ranges are applied in order, so where two overlap the later one wins for the
 * properties it sets and leaves the rest to the earlier one — which is what
 * makes "select a mixed run and set its size" end with the whole run at that
 * size while each word keeps its own bold. Overlapping ranges rendered as
 * nested markup, where a run's size multiplied the size of the run around it:
 * the same words came out at one size in the editor and another on the screen,
 * and never at the size that was typed.
 *
 * Runs styled like their neighbour are joined, runs left with no styling are
 * dropped, and empty spans are ignored.
 */
export function flattenSlideStyleRanges(
  ranges: readonly SlideStyleRange[],
): SlideStyleRange[] {
  const boundaries = new Set<number>()
  for (const range of ranges) {
    if (range.end <= range.start) continue
    boundaries.add(range.start)
    boundaries.add(range.end)
  }
  const cuts = [...boundaries].sort((a, b) => a - b)

  const flat: SlideStyleRange[] = []
  for (let i = 0; i + 1 < cuts.length; i++) {
    const start = cuts[i]
    const end = cuts[i + 1]
    const style: RangeStyle = {}
    for (const range of ranges) {
      if (range.start > start || range.end < end) continue
      for (const key of STYLE_KEYS) {
        if (range[key] !== undefined) {
          ;(style as Record<string, unknown>)[key] = range[key]
        }
      }
    }
    const merged = withoutDefaults(style)
    if (merged === null) continue

    const previous = flat[flat.length - 1]
    if (previous && previous.end === start && sameStyle(previous, merged)) {
      previous.end = end
      continue
    }
    flat.push({ start, end, ...merged })
  }
  return flat
}

/** The style with every "no styling" value removed, or null if none is left. */
function withoutDefaults(style: RangeStyle): RangeStyle | null {
  const kept: RangeStyle = {}
  if (style.bold) kept.bold = true
  if (style.italic) kept.italic = true
  if (style.underline) kept.underline = true
  if (style.fontScale !== undefined && style.fontScale !== 1) {
    kept.fontScale = style.fontScale
  }
  return Object.keys(kept).length > 0 ? kept : null
}

function sameStyle(a: RangeStyle, b: RangeStyle): boolean {
  return STYLE_KEYS.every((key) => a[key] === b[key])
}
