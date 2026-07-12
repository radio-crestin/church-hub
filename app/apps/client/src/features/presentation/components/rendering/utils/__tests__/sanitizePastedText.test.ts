import { describe, expect, it } from 'vitest'

import { sanitizePastedText } from '../sanitizePastedText'

describe('sanitizePastedText', () => {
  it('normalizes Windows and old-Mac line endings to \\n', () => {
    expect(sanitizePastedText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('replaces non-breaking spaces with normal spaces', () => {
    expect(sanitizePastedText('a b')).toBe('a b')
  })

  it('strips trailing spaces and tabs from each line', () => {
    expect(sanitizePastedText('verse one   \nverse two\t\t')).toBe(
      'verse one\nverse two',
    )
  })

  it('empties whitespace-only lines (tabs/spaces between verses)', () => {
    expect(sanitizePastedText('verse one\n\t \nverse two')).toBe(
      'verse one\n\nverse two',
    )
  })

  it('collapses runs of blank lines to at most one', () => {
    expect(sanitizePastedText('verse one\n\n\n\nverse two')).toBe(
      'verse one\n\nverse two',
    )
  })

  it('drops leading and trailing blank lines', () => {
    expect(sanitizePastedText('\n\nverse one\nverse two\n\n')).toBe(
      'verse one\nverse two',
    )
  })

  it('keeps leading indentation and internal spacing intact', () => {
    expect(sanitizePastedText('  indented line\nkeeps  double  spaces')).toBe(
      '  indented line\nkeeps  double  spaces',
    )
  })

  it('cleans a realistic rich-paste blob without mangling the verses', () => {
    const raw = 'Verse one line   \r\n\t\r\n\r\nVerse two   \r\n'
    expect(sanitizePastedText(raw)).toBe('Verse one line\n\nVerse two')
  })
})
