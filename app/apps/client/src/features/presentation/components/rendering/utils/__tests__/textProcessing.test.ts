import { describe, expect, it } from 'vitest'

import {
  compressLines,
  compressTextLinesWithFit,
  getSeparatorString,
} from '../textProcessing'

describe('textProcessing', () => {
  describe('getSeparatorString', () => {
    it('returns double space for "space" separator', () => {
      expect(getSeparatorString('space')).toBe('  ')
    })

    it('returns em dash for "dash" separator', () => {
      expect(getSeparatorString('dash')).toBe(' — ')
    })

    it('returns pipe for "pipe" separator', () => {
      expect(getSeparatorString('pipe')).toBe(' | ')
    })

    it('falls back to space for unknown separator type', () => {
      // Force an unknown type to test fallback
      expect(getSeparatorString('unknown' as never)).toBe('  ')
    })
  })

  describe('compressLines', () => {
    it('returns single line unchanged', () => {
      expect(compressLines('Hello world', 'dash')).toBe('Hello world')
    })

    it('keeps two lines as separate lines (no compression)', () => {
      const result = compressLines('Line 1\nLine 2', 'dash')
      expect(result).toBe('Line 1\nLine 2')
    })

    it('compresses 4 lines into 2 pairs with dash separator', () => {
      const result = compressLines('Line 1\nLine 2\nLine 3\nLine 4', 'dash')
      expect(result).toBe('Line 1 — Line 2\nLine 3 — Line 4')
    })

    it('compresses 3 lines - first pair combined, odd line standalone', () => {
      const result = compressLines('Line 1\nLine 2\nLine 3', 'dash')
      expect(result).toBe('Line 1 — Line 2\nLine 3')
    })

    it('uses pipe separator correctly', () => {
      const result = compressLines('A\nB\nC\nD', 'pipe')
      expect(result).toBe('A | B\nC | D')
    })

    it('uses space separator correctly', () => {
      const result = compressLines('A\nB\nC\nD', 'space')
      expect(result).toBe('A  B\nC  D')
    })

    it('filters out blank lines before compressing', () => {
      const result = compressLines('Line 1\n\nLine 2\n\nLine 3\nLine 4', 'dash')
      expect(result).toBe('Line 1 — Line 2\nLine 3 — Line 4')
    })

    it('trims whitespace from lines', () => {
      const result = compressLines('  Line 1  \n  Line 2  \n  Line 3  ', 'dash')
      expect(result).toBe('Line 1 — Line 2\nLine 3')
    })

    it('handles text with only blank lines', () => {
      const result = compressLines('\n\n\n', 'dash')
      expect(result).toBe('')
    })

    it('handles 6 lines - compresses into 3 pairs', () => {
      const result = compressLines('A\nB\nC\nD\nE\nF', 'dash')
      expect(result).toBe('A — B\nC — D\nE — F')
    })

    it('handles 5 lines - 2 pairs plus standalone', () => {
      const result = compressLines('A\nB\nC\nD\nE', 'dash')
      expect(result).toBe('A — B\nC — D\nE')
    })
  })

  describe('compressTextLinesWithFit', () => {
    const mockMeasureWidth = (text: string) => text.length * 10

    it('returns single line unchanged', () => {
      const result = compressTextLinesWithFit(
        'Hello',
        'dash',
        mockMeasureWidth,
        1000,
      )
      expect(result).toBe('Hello')
    })

    it('keeps two lines as separate lines (no compression)', () => {
      const result = compressTextLinesWithFit(
        'Line 1\nLine 2',
        'dash',
        mockMeasureWidth,
        1000,
      )
      expect(result).toBe('Line 1\nLine 2')
    })

    it('combines pairs when combined text fits within threshold', () => {
      // "A — B" = 5 chars = 50px width. Threshold = 1000 * 0.7 = 700. Fits.
      const result = compressTextLinesWithFit(
        'A\nB\nC\nD',
        'dash',
        mockMeasureWidth,
        1000,
      )
      expect(result).toBe('A — B\nC — D')
    })

    it('keeps pairs separate when combined text exceeds threshold', () => {
      // Very tight threshold
      const result = compressTextLinesWithFit(
        'Long line one here\nLong line two here\nShort\nX',
        'dash',
        mockMeasureWidth,
        100, // threshold = 100 * 0.7 = 70px
      )
      // "Long line one here — Long line two here" is way over 70px
      // "Short — X" = 11 chars = 110px, also over 70px
      expect(result).toBe('Long line one here\nLong line two here\nShort\nX')
    })

    it('mixes compressed and uncompressed pairs based on fit', () => {
      // Custom measure: each char = 10px
      const result = compressTextLinesWithFit(
        'AB\nCD\nVery long line number one\nVery long line number two',
        'dash',
        mockMeasureWidth,
        200, // threshold = 200 * 0.7 = 140px
      )
      // "AB — CD" = 7 chars = 70px, fits under 140
      // "Very long line number one — Very long line number two" is way over 140px
      expect(result).toBe(
        'AB — CD\nVery long line number one\nVery long line number two',
      )
    })

    it('uses custom fitThreshold', () => {
      // "AB — CD" = 7 chars = 70px
      // With threshold 0.5 and maxWidth 120: threshold = 60px. 70 > 60, doesn't fit
      const result = compressTextLinesWithFit(
        'AB\nCD\nE\nF',
        'dash',
        mockMeasureWidth,
        120,
        0.5,
      )
      // "AB — CD" = 70px > 60px threshold, stays separate
      // "E — F" = 5 chars = 50px < 60px threshold, compresses
      expect(result).toBe('AB\nCD\nE — F')
    })

    it('handles odd number of lines with last line standalone', () => {
      const result = compressTextLinesWithFit(
        'A\nB\nC',
        'dash',
        mockMeasureWidth,
        1000,
      )
      expect(result).toBe('A — B\nC')
    })

    it('filters blank lines before processing', () => {
      const result = compressTextLinesWithFit(
        'A\n\nB\n\nC\nD',
        'dash',
        mockMeasureWidth,
        1000,
      )
      expect(result).toBe('A — B\nC — D')
    })

    it('trims whitespace from lines', () => {
      const result = compressTextLinesWithFit(
        '  A  \n  B  \n  C  \n  D  ',
        'dash',
        mockMeasureWidth,
        1000,
      )
      expect(result).toBe('A — B\nC — D')
    })

    it('handles empty text', () => {
      const result = compressTextLinesWithFit(
        '',
        'dash',
        mockMeasureWidth,
        1000,
      )
      expect(result).toBe('')
    })

    it('uses default fitThreshold of 0.7 when not specified', () => {
      // "A — B" = 5 chars = 50px. maxWidth = 80, threshold = 80*0.7 = 56. 50 < 56, fits
      const result = compressTextLinesWithFit(
        'A\nB\nC\nD',
        'dash',
        mockMeasureWidth,
        80,
      )
      expect(result).toBe('A — B\nC — D')
    })
  })
})
