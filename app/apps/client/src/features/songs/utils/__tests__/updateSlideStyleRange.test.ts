import { describe, expect, it } from 'vitest'

import { updateSlideStyleRange } from '../updateSlideStyleRange'

const span = { start: 2, end: 7 }

describe('updateSlideStyleRange', () => {
  it('adds a styled run to a slide that had none', () => {
    const result = updateSlideStyleRange(null, span, { bold: true })
    expect(result.ranges).toEqual([{ start: 2, end: 7, bold: true }])
  })

  it('updates the run in place instead of stacking duplicates', () => {
    const first = updateSlideStyleRange(null, span, { bold: true })
    const second = updateSlideStyleRange(first, span, { italic: true })
    expect(second.ranges).toEqual([
      { start: 2, end: 7, bold: true, italic: true },
    ])
  })

  it('drops a run once its last style is toggled off', () => {
    const styled = updateSlideStyleRange(null, span, { bold: true })
    const cleared = updateSlideStyleRange(styled, span, { bold: false })
    expect(cleared.ranges).toEqual([])
  })

  it('leaves other runs and slide-level styling alone', () => {
    const base = updateSlideStyleRange({ fontScale: 1.2 }, span, {
      underline: true,
    })
    const result = updateSlideStyleRange(
      base,
      { start: 10, end: 14 },
      {
        bold: true,
      },
    )
    expect(result.fontScale).toBe(1.2)
    expect(result.ranges).toHaveLength(2)
  })
})
