import { describe, expect, it } from 'vitest'

import { calculateFontSize } from '../calculateFontSize'

/**
 * An element whose content is `lineHeights` font sizes tall, so the size that
 * fits a box is known exactly: jsdom does no layout of its own.
 */
function elementWithTextHeight(lineHeights: number): HTMLElement {
  const element = document.createElement('div')
  Object.defineProperty(element, 'scrollHeight', {
    get: () => Number.parseFloat(element.style.fontSize) * lineHeights,
  })
  return element
}

describe('calculateFontSize', () => {
  it('fits to a tenth of a pixel, so a small preview stays to scale', () => {
    // 4 lines in a 51.2px box: 12.8px fits, 12.9px does not.
    const size = calculateFontSize(
      elementWithTextHeight(4),
      'four lines',
      300,
      51.2,
      200,
      1,
    )

    expect(size).toBe(12.8)
  })

  it('fits the same text to the same share of the box at any scale', () => {
    const screen = calculateFontSize(
      elementWithTextHeight(5),
      'lyrics',
      1800,
      1015.2,
      2000,
      12,
    )
    const preview = calculateFontSize(
      elementWithTextHeight(5),
      'lyrics',
      300,
      1015.2 / 6,
      2000 / 6,
      12 / 6,
    )

    expect(preview * 6).toBeCloseTo(screen, 0)
    expect(Math.abs((preview * 6) / screen - 1)).toBeLessThan(0.005)
  })

  it('keeps the maximum when the text fits at it', () => {
    expect(
      calculateFontSize(elementWithTextHeight(1), 'x', 300, 500, 48, 12),
    ).toBe(48)
  })

  it('falls back to the minimum when nothing fits', () => {
    expect(
      calculateFontSize(elementWithTextHeight(10), 'x', 300, 20, 48, 6.5),
    ).toBe(6.5)
  })

  it('restores the styles it measured with', () => {
    const element = elementWithTextHeight(2)
    element.style.fontSize = '30px'
    element.style.width = '10px'

    calculateFontSize(element, 'text', 300, 100, 80, 12)

    expect(element.style.fontSize).toBe('30px')
    expect(element.style.width).toBe('10px')
  })
})
