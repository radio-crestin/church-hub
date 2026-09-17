import { describe, expect, it } from 'vitest'

import type { TextStyle } from '../../../../types'
import { scaleTextStyle } from '../scaleTextStyle'

const style: TextStyle = {
  fontFamily: 'Times New Roman',
  maxFontSize: 200,
  autoScale: true,
  color: '#ffffff',
  bold: false,
  italic: false,
  underline: false,
  alignment: 'center',
  verticalAlignment: 'middle',
  lineHeight: 1.3,
}

describe('scaleTextStyle', () => {
  it('scales the ceiling and the configured floor by the same factor', () => {
    const scaled = scaleTextStyle({ ...style, minFontSize: 40 }, 0.25)

    expect(scaled.maxFontSize).toBe(50)
    expect(scaled.minFontSize).toBe(10)
  })

  it('scales the default 12px floor when the style sets none', () => {
    expect(scaleTextStyle(style, 0.5).minFontSize).toBe(6)
  })

  it('leaves a screen drawn at its own size unchanged', () => {
    const scaled = scaleTextStyle({ ...style, minFontSize: 24 }, 1)

    expect(scaled.maxFontSize).toBe(200)
    expect(scaled.minFontSize).toBe(24)
  })

  it('keeps every other style setting', () => {
    const scaled = scaleTextStyle(
      { ...style, bold: true, compressLines: true, lineSeparator: 'dash' },
      0.3,
    )

    expect(scaled).toMatchObject({
      fontFamily: 'Times New Roman',
      bold: true,
      compressLines: true,
      lineSeparator: 'dash',
      lineHeight: 1.3,
    })
  })

  it('does not change the style it is given', () => {
    const original = { ...style, minFontSize: 30 }
    scaleTextStyle(original, 0.2)

    expect(original).toEqual({ ...style, minFontSize: 30 })
  })
})
