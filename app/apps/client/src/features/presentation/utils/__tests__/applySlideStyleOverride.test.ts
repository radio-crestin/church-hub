import { describe, expect, it } from 'vitest'

import type { TextStyle } from '../../types'
import {
  applySlideStyleOverride,
  resolveSlideFontScale,
} from '../applySlideStyleOverride'
import { toTextStyleRanges } from '../toTextStyleRanges'

const screenStyle: TextStyle = {
  fontFamily: 'Inter',
  maxFontSize: 80,
  minFontSize: 20,
  autoScale: true,
  color: '#ffffff',
  bold: false,
  italic: false,
  underline: false,
  alignment: 'center',
  verticalAlignment: 'middle',
  lineHeight: 1.2,
}

describe('applySlideStyleOverride', () => {
  it('returns the screen style untouched when there is no override', () => {
    expect(applySlideStyleOverride(screenStyle, null)).toBe(screenStyle)
    expect(applySlideStyleOverride(screenStyle, undefined)).toBe(screenStyle)
  })

  it('leaves the font bounds alone — the scale applies to the fitted size', () => {
    const scaled = applySlideStyleOverride(screenStyle, { fontScale: 1.5 })
    expect(scaled.maxFontSize).toBe(80)
    expect(scaled.minFontSize).toBe(20)
    expect(resolveSlideFontScale({ fontScale: 1.5 })).toBe(1.5)
    expect(resolveSlideFontScale(null)).toBe(1)
    expect(resolveSlideFontScale({ bold: true })).toBe(1)
  })

  it('overrides only the keys the slide states', () => {
    const styled = applySlideStyleOverride(screenStyle, {
      bold: true,
      alignment: 'left',
    })
    expect(styled.bold).toBe(true)
    expect(styled.alignment).toBe('left')
    expect(styled.italic).toBe(false)
    expect(styled.underline).toBe(false)
    expect(styled.maxFontSize).toBe(80)
    expect(styled.verticalAlignment).toBe('middle')
  })
})

describe('toTextStyleRanges', () => {
  it('is empty without ranges', () => {
    expect(toTextStyleRanges(null)).toEqual([])
    expect(toTextStyleRanges({ bold: true })).toEqual([])
  })

  it('keeps the id stable for the same span', () => {
    const override = { ranges: [{ start: 3, end: 9, bold: true }] }
    const [first] = toTextStyleRanges(override)
    const [second] = toTextStyleRanges(override)
    expect(first.id).toBe(second.id)
    expect(first).toMatchObject({ start: 3, end: 9, bold: true })
  })
})
