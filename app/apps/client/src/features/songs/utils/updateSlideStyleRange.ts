import type { SlideStyleOverride, SlideStyleRange } from '../types'

/**
 * Applies a styling patch to one run of a slide's text.
 *
 * Ranges are keyed by their exact span, so styling the same selection twice
 * updates that entry instead of stacking duplicates. A run left with no styling
 * is dropped, which is what makes toggling bold off actually remove it rather
 * than storing `bold: false` forever.
 */
export function updateSlideStyleRange(
  override: SlideStyleOverride | null | undefined,
  span: { start: number; end: number },
  patch: Partial<Omit<SlideStyleRange, 'start' | 'end'>>,
): SlideStyleOverride {
  const ranges = override?.ranges ?? []
  const existing = ranges.find(
    (range) => range.start === span.start && range.end === span.end,
  )

  const merged: SlideStyleRange = {
    ...(existing ?? { start: span.start, end: span.end }),
    ...patch,
  }

  const isEmpty =
    !merged.bold &&
    !merged.italic &&
    !merged.underline &&
    (merged.fontScale === undefined || merged.fontScale === 1)

  const rest = ranges.filter((range) => range !== existing)

  return {
    ...override,
    ranges: isEmpty ? rest : [...rest, merged],
  }
}
