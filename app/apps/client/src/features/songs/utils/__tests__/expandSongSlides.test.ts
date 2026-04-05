import { describe, expect, it } from 'vitest'

import type { SongSlide } from '../../types'
import {
  expandSongSlidesWithChoruses,
  generateExpandedPresentationOrder,
} from '../expandSongSlides'

function makeSlide(
  overrides: Partial<SongSlide> & { id: number; sortOrder: number },
): SongSlide {
  return {
    songId: 1,
    content: `Slide ${overrides.id}`,
    chords: null,
    label: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('expandSongSlidesWithChoruses', () => {
  it('returns empty array for empty input', () => {
    expect(expandSongSlidesWithChoruses([])).toEqual([])
  })

  it('returns slides as-is when no labels exist', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0 }),
      makeSlide({ id: 2, sortOrder: 1 }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(2)
    expect(result[0].originalIndex).toBe(0)
    expect(result[1].originalIndex).toBe(1)
  })

  it('returns slides as-is when there are labels but no choruses', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'V1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V2' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.label)).toEqual(['V1', 'V2'])
  })

  it('returns slides as-is when there are choruses but no verses', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'C2' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(2)
  })

  it('inserts chorus after each verse (standard case)', () => {
    // Input: [C1, V1, V2, V3, C2]
    // Expected: [C1, V1, C1, V2, C1, V3, C2]
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
      makeSlide({ id: 3, sortOrder: 2, label: 'V2' }),
      makeSlide({ id: 4, sortOrder: 3, label: 'V3' }),
      makeSlide({ id: 5, sortOrder: 4, label: 'C2' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    const labels = result.map((s) => s.label)
    expect(labels).toEqual(['C1', 'V1', 'C1', 'V2', 'C1', 'V3', 'C2'])
  })

  it('does not insert chorus before a following chorus slide', () => {
    // Input: [C1, V1, C2, V2]
    // Expected: [C1, V1, C2, V2, C2]
    // V1 is followed by C2, so C1 should NOT be inserted after V1
    // V2 is last, so C2 should be inserted after V2
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
      makeSlide({ id: 3, sortOrder: 2, label: 'C2' }),
      makeSlide({ id: 4, sortOrder: 3, label: 'V2' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    const labels = result.map((s) => s.label)
    expect(labels).toEqual(['C1', 'V1', 'C2', 'V2', 'C2'])
  })

  it('handles a single verse after a chorus', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    const labels = result.map((s) => s.label)
    expect(labels).toEqual(['C1', 'V1', 'C1'])
  })

  it('does not insert chorus if verse comes before any chorus is defined', () => {
    // V1 appears before C1, so no chorus to insert after V1
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'V1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'C1' }),
      makeSlide({ id: 3, sortOrder: 2, label: 'V2' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    const labels = result.map((s) => s.label)
    expect(labels).toEqual(['V1', 'C1', 'V2', 'C1'])
  })

  it('sorts by sortOrder before processing', () => {
    // Provide slides out of order
    const slides = [
      makeSlide({ id: 3, sortOrder: 2, label: 'V2' }),
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    const labels = result.map((s) => s.label)
    expect(labels).toEqual(['C1', 'V1', 'C1', 'V2', 'C1'])
  })

  it('assigns correct displayIndex values', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
      makeSlide({ id: 3, sortOrder: 2, label: 'V2' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result.map((s) => s.displayIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('preserves originalIndex from sorted position', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    // C1 original=0, V1 original=1, inserted C1 original=0
    expect(result.map((s) => s.originalIndex)).toEqual([0, 1, 0])
  })

  it('handles mixed labeled and unlabeled slides', () => {
    // Has labels and at least one chorus and verse
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
      makeSlide({ id: 3, sortOrder: 2, label: null }),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    // V1 is followed by unlabeled (not a chorus), so chorus gets inserted
    const labels = result.map((s) => s.label)
    expect(labels).toEqual(['C1', 'V1', 'C1', null])
  })

  it('handles single slide input', () => {
    const slides = [makeSlide({ id: 1, sortOrder: 0, label: 'V1' })]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('V1')
  })
})

describe('generateExpandedPresentationOrder', () => {
  it('returns empty string for empty input', () => {
    expect(generateExpandedPresentationOrder([])).toBe('')
  })

  it('returns empty string when no labels exist', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0 }),
      makeSlide({ id: 2, sortOrder: 1 }),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('')
  })

  it('returns original label order when no choruses', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'V1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V2' }),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('V1 V2')
  })

  it('returns original label order when no verses', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'C2' }),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('C1 C2')
  })

  it('generates expanded order with chorus insertions', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
      makeSlide({ id: 3, sortOrder: 2, label: 'V2' }),
      makeSlide({ id: 4, sortOrder: 3, label: 'V3' }),
      makeSlide({ id: 5, sortOrder: 4, label: 'C2' }),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe(
      'C1 V1 C1 V2 C1 V3 C2',
    )
  })

  it('does not insert chorus label when next slide is a chorus', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
      makeSlide({ id: 3, sortOrder: 2, label: 'C2' }),
      makeSlide({ id: 4, sortOrder: 3, label: 'V2' }),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('C1 V1 C2 V2 C2')
  })

  it('skips unlabeled slides in the order string', () => {
    const slides = [
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
      makeSlide({ id: 3, sortOrder: 2, label: null }),
    ]
    // V1 is followed by unlabeled (not chorus), so C1 inserted after V1
    expect(generateExpandedPresentationOrder(slides)).toBe('C1 V1 C1')
  })

  it('sorts by sortOrder before generating', () => {
    const slides = [
      makeSlide({ id: 3, sortOrder: 2, label: 'V2' }),
      makeSlide({ id: 1, sortOrder: 0, label: 'C1' }),
      makeSlide({ id: 2, sortOrder: 1, label: 'V1' }),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('C1 V1 C1 V2 C1')
  })
})
