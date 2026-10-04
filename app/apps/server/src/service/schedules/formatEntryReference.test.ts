import { formatEntryReference } from './formatEntryReference'
import type { VerseteTineriEntryInput } from './types'
import { describe, expect, it } from 'bun:test'

const ioan3 = (
  startVerse: number,
  endVerse: number,
  extra: Partial<VerseteTineriEntryInput> = {},
): VerseteTineriEntryInput => ({
  translationId: 1,
  bookCode: 'JHN',
  bookName: 'Ioan',
  startChapter: 3,
  startVerse,
  endChapter: 3,
  endVerse,
  ...extra,
})

describe('formatEntryReference', () => {
  it('writes a plain range', () => {
    expect(formatEntryReference(ioan3(16, 17))).toBe('Ioan 3:16-17')
    expect(formatEntryReference(ioan3(16, 16))).toBe('Ioan 3:16')
  })

  it('writes a verse list with a gap as typed', () => {
    const entry = ioan3(16, 20, {
      verseSegments: [
        { startVerse: 16, endVerse: 18 },
        { startVerse: 20, endVerse: 20 },
      ],
    })
    expect(formatEntryReference(entry)).toBe('Ioan 3:16-18,20')
  })

  it('ignores an empty segment list', () => {
    expect(formatEntryReference(ioan3(16, 18, { verseSegments: [] }))).toBe(
      'Ioan 3:16-18',
    )
  })

  it('still writes a reading across chapters', () => {
    expect(formatEntryReference(ioan3(16, 2, { endChapter: 4 }))).toBe(
      'Ioan 3:16 - 4:2',
    )
  })
})
