import { sanitizeSongTitle } from './sanitizeTitle'
import { describe, expect, it } from 'bun:test'

describe('sanitizeSongTitle', () => {
  describe('basic sanitization', () => {
    it('removes leading numbers and dash', () => {
      expect(sanitizeSongTitle('050 - Veniti crestini')).toBe('Veniti crestini')
    })

    it('removes /: prefix', () => {
      expect(sanitizeSongTitle('/: Am cautat pe Domnul')).toBe(
        'Am cautat pe Domnul',
      )
    })

    it('removes exclamation marks', () => {
      expect(sanitizeSongTitle('Te-am ales sa fii al Meu!')).toBe(
        'Te-am ales sa fii al Meu',
      )
    })

    it('removes quotes', () => {
      expect(sanitizeSongTitle('"O clipa" spune Isus')).toBe(
        'O clipa spune Isus',
      )
    })

    it('preserves accented characters', () => {
      expect(sanitizeSongTitle('Am cautat pe Domnul')).toBe(
        'Am cautat pe Domnul',
      )
    })

    it('preserves Romanian diacritics', () => {
      expect(sanitizeSongTitle('Sfanta noapte')).toBe('Sfanta noapte')
    })

    it('preserves hyphens within words', () => {
      expect(sanitizeSongTitle('Te-am ales')).toBe('Te-am ales')
    })
  })

  describe('edge cases', () => {
    it('returns "Untitled Song" for empty string', () => {
      expect(sanitizeSongTitle('')).toBe('Untitled Song')
    })

    it('returns "Untitled Song" for whitespace-only string', () => {
      expect(sanitizeSongTitle('   ')).toBe('Untitled Song')
    })

    it('returns "Untitled Song" for string with only special chars', () => {
      expect(sanitizeSongTitle('/:.*')).toBe('Untitled Song')
    })

    it('normalizes multiple spaces to single space', () => {
      expect(sanitizeSongTitle('Hello    World')).toBe('Hello World')
    })

    it('normalizes multiple hyphens to single', () => {
      expect(sanitizeSongTitle('Hello---World')).toBe('Hello-World')
    })

    it('removes leading hyphens', () => {
      expect(sanitizeSongTitle('- Hello')).toBe('Hello')
    })

    it('removes trailing hyphens', () => {
      expect(sanitizeSongTitle('Hello -')).toBe('Hello')
    })
  })

  describe('leading special characters', () => {
    it('removes leading dots', () => {
      expect(sanitizeSongTitle('... Hello World')).toBe('Hello World')
    })

    it('removes leading bullet point', () => {
      const result = sanitizeSongTitle('\u2022 Hello World')
      expect(result).toBe('Hello World')
    })

    it('removes leading play symbol', () => {
      const result = sanitizeSongTitle('\u25BA Hello World')
      expect(result).toBe('Hello World')
    })

    it('removes leading asterisk', () => {
      expect(sanitizeSongTitle('* Hello World')).toBe('Hello World')
    })

    it('removes mixed leading special characters', () => {
      expect(sanitizeSongTitle('/:123 Hello World')).toBe('Hello World')
    })
  })

  describe('complex titles', () => {
    it('handles title with numbers in the middle', () => {
      // Leading number+special removal only applies to prefix; mid-title numbers
      // become spaces via the non-letter regex, but the hyphen is preserved
      const result = sanitizeSongTitle('Psalm 23 - The Lord is my Shepherd')
      expect(result).toBe('Psalm - The Lord is my Shepherd')
    })

    it('handles title with parentheses', () => {
      expect(sanitizeSongTitle('Holy (Live Version)')).toBe('Holy Live Version')
    })

    it('handles title with mixed special chars', () => {
      expect(sanitizeSongTitle('Song #1: Amazing!')).toBe('Song Amazing')
    })
  })
})
