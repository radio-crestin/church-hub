import { describe, expect, it } from 'vitest'

import { fitFontSizeToBounds } from '../fitFontSizeToBounds'

/** An element whose content is `lineHeights` font sizes tall (jsdom has no layout). */
function elementWithTextHeight(lineHeights: number): HTMLElement {
  const element = document.createElement('div')
  Object.defineProperty(element, 'scrollHeight', {
    get: () => Number.parseFloat(element.style.fontSize) * lineHeights,
  })
  return element
}

describe('fitFontSizeToBounds', () => {
  it('keeps the desired size when it fits', () => {
    expect(
      fitFontSizeToBounds(
        elementWithTextHeight(4),
        'text',
        null,
        20,
        300,
        100,
        1,
      ),
    ).toBe(20)
  })

  it('brings an overflowing size down to a tenth of a pixel', () => {
    // 4 lines in a 51.2px box: 12.8px is the largest size that stays inside.
    expect(
      fitFontSizeToBounds(
        elementWithTextHeight(4),
        'text',
        null,
        30,
        300,
        51.2,
        1,
      ),
    ).toBe(12.8)
  })

  it('does not go below the minimum', () => {
    expect(
      fitFontSizeToBounds(
        elementWithTextHeight(10),
        'text',
        null,
        30,
        300,
        20,
        4.5,
      ),
    ).toBe(4.5)
  })
})
