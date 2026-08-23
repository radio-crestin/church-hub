import { describe, expect, it } from 'vitest'

import { flattenSlideStyleRanges } from '../flattenSlideStyleRanges'

describe('flattenSlideStyleRanges', () => {
  it('leaves runs that do not overlap as they are, sorted', () => {
    expect(
      flattenSlideStyleRanges([
        { start: 5, end: 10, fontScale: 1.27 },
        { start: 0, end: 5, fontScale: 1.35 },
      ]),
    ).toEqual([
      { start: 0, end: 5, fontScale: 1.35 },
      { start: 5, end: 10, fontScale: 1.27 },
    ])
  })

  it('lets a later run override the size of the runs it covers', () => {
    // Two words at different sizes, then the whole selection set to one size.
    expect(
      flattenSlideStyleRanges([
        { start: 0, end: 5, fontScale: 1.35 },
        { start: 5, end: 10, fontScale: 1.27 },
        { start: 0, end: 10, fontScale: 0.889 },
      ]),
    ).toEqual([{ start: 0, end: 10, fontScale: 0.889 }])
  })

  it('keeps the styling a later run does not mention', () => {
    expect(
      flattenSlideStyleRanges([
        { start: 0, end: 5, bold: true },
        { start: 3, end: 8, fontScale: 1.5 },
      ]),
    ).toEqual([
      { start: 0, end: 3, bold: true },
      { start: 3, end: 5, bold: true, fontScale: 1.5 },
      { start: 5, end: 8, fontScale: 1.5 },
    ])
  })

  it('drops runs that end up with no styling', () => {
    expect(
      flattenSlideStyleRanges([
        { start: 0, end: 10, bold: true, fontScale: 1.2 },
        { start: 2, end: 4, bold: false, fontScale: 1 },
      ]),
    ).toEqual([
      { start: 0, end: 2, bold: true, fontScale: 1.2 },
      { start: 4, end: 10, bold: true, fontScale: 1.2 },
    ])
  })

  it('ignores empty and inverted spans', () => {
    expect(
      flattenSlideStyleRanges([
        { start: 4, end: 4, bold: true },
        { start: 6, end: 2, italic: true },
        { start: 0, end: 1, underline: true },
      ]),
    ).toEqual([{ start: 0, end: 1, underline: true }])
  })

  it('flattens the stacked runs a slide styled by the old editor holds', () => {
    // Recorded from a real slide: every size change added another overlapping
    // run instead of replacing the one underneath.
    const flat = flattenSlideStyleRanges([
      { start: 0, end: 106, fontScale: 1.0068 },
      { start: 3, end: 14, fontScale: 1.0476 },
      { start: 6, end: 14, fontScale: 1.0625 },
      { start: 0, end: 109, fontScale: 0.809 },
    ])
    expect(flat).toEqual([{ start: 0, end: 109, fontScale: 0.809 }])
  })
})
