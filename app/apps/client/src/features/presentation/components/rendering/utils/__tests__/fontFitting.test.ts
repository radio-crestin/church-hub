import { beforeEach, describe, expect, it } from 'vitest'

import { findOptimalFontSize, findOptimalFontSizePerLine } from '../fontFitting'

/**
 * Creates a mock HTMLElement that simulates scrollHeight/scrollWidth
 * based on font size and text content.
 */
function createMockMeasureElement(options?: {
  /** Pixels per character at font size 1px */
  charWidthRatio?: number
  /** Line height multiplier applied to font size for each line */
  lineHeightMultiplier?: number
}) {
  const charWidthRatio = options?.charWidthRatio ?? 0.6
  const _lineHeightMultiplier = options?.lineHeightMultiplier ?? 1.2

  const styles: Record<string, string> = {}
  let textContent = ''

  const element = {
    get textContent() {
      return textContent
    },
    set textContent(value: string | null) {
      textContent = value ?? ''
    },
    style: new Proxy(styles, {
      get(target, prop: string) {
        return target[prop] ?? ''
      },
      set(target, prop: string, value: string) {
        target[prop] = value
        return true
      },
    }),
    get scrollHeight() {
      const fontSize = Number.parseFloat(styles.fontSize || '16')
      const lineHeight = Number.parseFloat(styles.lineHeight || '1.2')
      const maxWidth = Number.parseFloat(styles.width || '9999')
      const lines = textContent.split('\n')

      let totalLines = 0
      for (const line of lines) {
        if (line.trim() === '') {
          totalLines += 1
          continue
        }
        const lineWidth = line.length * fontSize * charWidthRatio
        const wrappedLines = Math.max(1, Math.ceil(lineWidth / maxWidth))
        totalLines += wrappedLines
      }

      return totalLines * fontSize * lineHeight
    },
    get scrollWidth() {
      const fontSize = Number.parseFloat(styles.fontSize || '16')
      const charWidth = fontSize * charWidthRatio
      const lines = textContent.split('\n')
      let maxLineWidth = 0
      for (const line of lines) {
        maxLineWidth = Math.max(maxLineWidth, line.length * charWidth)
      }
      return maxLineWidth
    },
  }

  return element as unknown as HTMLElement
}

describe('fontFitting', () => {
  describe('findOptimalFontSize', () => {
    let measureElement: HTMLElement

    beforeEach(() => {
      measureElement = createMockMeasureElement()
    })

    it('returns maxFontSize when text fits at max size', () => {
      const result = findOptimalFontSize({
        measureElement,
        text: 'Hi',
        maxWidth: 2000,
        maxHeight: 2000,
        minFontSize: 12,
        maxFontSize: 200,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBe(200)
      expect(result.fits).toBe(true)
    })

    it('returns minFontSize with fits=false when text is too large even at min size', () => {
      const result = findOptimalFontSize({
        measureElement,
        text: 'A very long line that will not fit in a tiny box at any font size whatsoever even at minimum',
        maxWidth: 10,
        maxHeight: 5,
        minFontSize: 12,
        maxFontSize: 200,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBe(12)
      expect(result.fits).toBe(false)
    })

    it('performs binary search to find an intermediate font size', () => {
      // Short text, moderate container
      const result = findOptimalFontSize({
        measureElement,
        text: 'Hello World',
        maxWidth: 200,
        maxHeight: 50,
        minFontSize: 8,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBeGreaterThanOrEqual(8)
      expect(result.fontSize).toBeLessThanOrEqual(100)
      expect(result.fits).toBe(true)
    })

    it('handles multiline text', () => {
      const result = findOptimalFontSize({
        measureElement,
        text: 'Line 1\nLine 2\nLine 3',
        maxWidth: 300,
        maxHeight: 100,
        minFontSize: 8,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      expect(result.fits).toBe(true)
      expect(result.fontSize).toBeGreaterThanOrEqual(8)
    })

    it('handles empty text', () => {
      const result = findOptimalFontSize({
        measureElement,
        text: '',
        maxWidth: 200,
        maxHeight: 200,
        minFontSize: 12,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      // Empty text has zero height, so max fits
      expect(result.fontSize).toBe(100)
      expect(result.fits).toBe(true)
    })

    it('restores original element styles after measurement', () => {
      const el = createMockMeasureElement()
      el.style.fontSize = '20px'
      el.style.whiteSpace = 'normal'
      el.style.width = '500px'
      el.textContent = 'Original'

      findOptimalFontSize({
        measureElement: el,
        text: 'Test',
        maxWidth: 200,
        maxHeight: 100,
        minFontSize: 10,
        maxFontSize: 50,
        lineHeight: 1.4,
      })

      expect(el.style.fontSize).toBe('20px')
      expect(el.style.whiteSpace).toBe('normal')
      expect(el.style.width).toBe('500px')
      expect(el.textContent).toBe('Original')
    })

    it('handles minFontSize equal to maxFontSize', () => {
      const result = findOptimalFontSize({
        measureElement,
        text: 'Test',
        maxWidth: 500,
        maxHeight: 500,
        minFontSize: 24,
        maxFontSize: 24,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBe(24)
      expect(result.fits).toBe(true)
    })

    it('converges within tolerance of 1px', () => {
      const result = findOptimalFontSize({
        measureElement,
        text: 'Some text that needs binary search to fit',
        maxWidth: 400,
        maxHeight: 60,
        minFontSize: 8,
        maxFontSize: 200,
        lineHeight: 1.2,
      })

      // The result should be within 1px tolerance of the true optimal
      expect(result.fits).toBe(true)
      expect(Number.isInteger(result.fontSize)).toBe(true)
    })
  })

  describe('findOptimalFontSizePerLine', () => {
    let measureElement: HTMLElement

    beforeEach(() => {
      measureElement = createMockMeasureElement()
    })

    it('returns maxFontSize for empty text', () => {
      const result = findOptimalFontSizePerLine({
        measureElement,
        text: '',
        maxWidth: 500,
        maxHeight: 200,
        minFontSize: 12,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBe(100)
      expect(result.fits).toBe(true)
    })

    it('returns maxFontSize when only blank lines exist', () => {
      const result = findOptimalFontSizePerLine({
        measureElement,
        text: '\n\n  \n',
        maxWidth: 500,
        maxHeight: 200,
        minFontSize: 12,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBe(100)
      expect(result.fits).toBe(true)
    })

    it('returns maxFontSize when all lines fit at max size', () => {
      const result = findOptimalFontSizePerLine({
        measureElement,
        text: 'Hi\nOK',
        maxWidth: 2000,
        maxHeight: 2000,
        minFontSize: 12,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBe(100)
      expect(result.fits).toBe(true)
    })

    it('uses minimum font size across all lines for consistency', () => {
      // One short line and one long line
      const result = findOptimalFontSizePerLine({
        measureElement,
        text: 'Hi\nThis is a much much much longer line that needs smaller font',
        maxWidth: 300,
        maxHeight: 2000,
        minFontSize: 8,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      // The font size should be constrained by the longest line
      expect(result.fits).toBe(true)
      expect(result.fontSize).toBeGreaterThanOrEqual(8)
      expect(result.fontSize).toBeLessThanOrEqual(100)
    })

    it('never returns less than minFontSize', () => {
      const result = findOptimalFontSizePerLine({
        measureElement,
        text: 'A very very very very very very very very very very long line',
        maxWidth: 50,
        maxHeight: 2000,
        minFontSize: 10,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      expect(result.fontSize).toBeGreaterThanOrEqual(10)
      expect(result.fits).toBe(true)
    })

    it('restores original element styles after measurement', () => {
      const el = createMockMeasureElement()
      el.style.fontSize = '14px'
      el.style.display = 'block'
      el.style.visibility = 'visible'
      el.textContent = 'Original'

      findOptimalFontSizePerLine({
        measureElement: el,
        text: 'Test\nLines',
        maxWidth: 300,
        maxHeight: 200,
        minFontSize: 8,
        maxFontSize: 80,
        lineHeight: 1.3,
      })

      expect(el.style.fontSize).toBe('14px')
      expect(el.style.display).toBe('block')
      expect(el.style.visibility).toBe('visible')
      expect(el.textContent).toBe('Original')
    })

    it('handles single line text', () => {
      const result = findOptimalFontSizePerLine({
        measureElement,
        text: 'Single line',
        maxWidth: 300,
        maxHeight: 200,
        minFontSize: 8,
        maxFontSize: 100,
        lineHeight: 1.2,
      })

      expect(result.fits).toBe(true)
      expect(result.fontSize).toBeGreaterThanOrEqual(8)
    })
  })
})
