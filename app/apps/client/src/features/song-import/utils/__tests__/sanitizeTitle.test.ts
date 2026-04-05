import { describe, expect, it } from 'vitest'

import { sanitizeSongTitle } from '../sanitizeTitle'

describe('song-import/utils/sanitizeTitle', () => {
  it('removes leading numbers', () => {
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
    expect(sanitizeSongTitle('"O clipa" spune Isus')).toBe('O clipa spune Isus')
  })

  it('preserves accented characters', () => {
    expect(sanitizeSongTitle('Am cautat pe Domnul')).toBe('Am cautat pe Domnul')
  })

  it('preserves hyphens between words', () => {
    expect(sanitizeSongTitle('Te-am ales')).toBe('Te-am ales')
  })

  it('normalizes multiple spaces', () => {
    expect(sanitizeSongTitle('Multiple   spaces   here')).toBe(
      'Multiple spaces here',
    )
  })

  it('normalizes multiple hyphens', () => {
    expect(sanitizeSongTitle('word--other')).toBe('word-other')
  })

  it('removes leading/trailing hyphens', () => {
    expect(sanitizeSongTitle('- Title -')).toBe('Title')
  })

  it('returns "Untitled Song" for empty string', () => {
    expect(sanitizeSongTitle('')).toBe('Untitled Song')
  })

  it('returns "Untitled Song" for whitespace-only string', () => {
    expect(sanitizeSongTitle('   ')).toBe('Untitled Song')
  })

  it('returns "Untitled Song" when only special chars remain', () => {
    expect(sanitizeSongTitle('123 #$%')).toBe('Untitled Song')
  })

  it('removes leading dots and asterisks', () => {
    expect(sanitizeSongTitle('* Song Title')).toBe('Song Title')
    expect(sanitizeSongTitle('... Song Title')).toBe('Song Title')
  })

  it('handles bullet points', () => {
    const result = sanitizeSongTitle('\u25BA Song Title')
    expect(result).toBe('Song Title')
  })
})
