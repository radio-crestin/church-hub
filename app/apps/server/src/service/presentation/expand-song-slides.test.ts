import {
  expandSongSlidesWithChoruses,
  generateExpandedPresentationOrder,
  getOriginalSlideIndex,
} from './expand-song-slides'
import { describe, expect, it } from 'bun:test'

function makeSlide(
  id: number,
  label: string | null,
  sortOrder: number,
  content = '',
) {
  return { id, label, sortOrder, content }
}

describe('expandSongSlidesWithChoruses', () => {
  it('returns empty array for empty input', () => {
    expect(expandSongSlidesWithChoruses([])).toEqual([])
  })

  it('returns slides with originalIndex when no labels exist', () => {
    const slides = [
      makeSlide(1, null, 0),
      makeSlide(2, null, 1),
      makeSlide(3, null, 2),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(3)
    expect(result[0].originalIndex).toBe(0)
    expect(result[1].originalIndex).toBe(1)
    expect(result[2].originalIndex).toBe(2)
  })

  it('returns original order when no choruses exist', () => {
    const slides = [
      makeSlide(1, 'V1', 0),
      makeSlide(2, 'V2', 1),
      makeSlide(3, 'V3', 2),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(3)
    expect(result.map((s) => s.label)).toEqual(['V1', 'V2', 'V3'])
  })

  it('returns original order when no verses exist (only choruses)', () => {
    const slides = [makeSlide(1, 'C1', 0), makeSlide(2, 'C2', 1)]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.label)).toEqual(['C1', 'C2'])
  })

  it('inserts chorus after each verse - basic case', () => {
    // Input: C1, V1, V2, V3, C2
    // Expected: C1, V1, C1, V2, C1, V3, C2
    const slides = [
      makeSlide(1, 'C1', 0),
      makeSlide(2, 'V1', 1),
      makeSlide(3, 'V2', 2),
      makeSlide(4, 'V3', 3),
      makeSlide(5, 'C2', 4),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result.map((s) => s.label)).toEqual([
      'C1',
      'V1',
      'C1',
      'V2',
      'C1',
      'V3',
      'C2',
    ])
  })

  it('does not insert chorus before a new chorus', () => {
    // When next slide is a chorus, skip insertion because the new chorus replaces
    // Input: C1, V1, C2
    // Expected: C1, V1, C2 (no C1 inserted before C2)
    const slides = [
      makeSlide(1, 'C1', 0),
      makeSlide(2, 'V1', 1),
      makeSlide(3, 'C2', 2),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result.map((s) => s.label)).toEqual(['C1', 'V1', 'C2'])
  })

  it('updates current chorus when a new chorus appears', () => {
    // Input: C1, V1, V2, C2, V3
    // Expected: C1, V1, C1, V2, C2, V3, C2
    const slides = [
      makeSlide(1, 'C1', 0),
      makeSlide(2, 'V1', 1),
      makeSlide(3, 'V2', 2),
      makeSlide(4, 'C2', 3),
      makeSlide(5, 'V3', 4),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result.map((s) => s.label)).toEqual([
      'C1',
      'V1',
      'C1',
      'V2',
      'C2',
      'V3',
      'C2',
    ])
  })

  it('does not insert chorus before first chorus is seen', () => {
    // Input: V1, V2, C1, V3
    // Verses before C1 have no chorus to insert
    // Expected: V1, V2, C1, V3, C1
    const slides = [
      makeSlide(1, 'V1', 0),
      makeSlide(2, 'V2', 1),
      makeSlide(3, 'C1', 2),
      makeSlide(4, 'V3', 3),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result.map((s) => s.label)).toEqual(['V1', 'V2', 'C1', 'V3', 'C1'])
  })

  it('preserves originalIndex pointing to correct source slide', () => {
    const slides = [
      makeSlide(10, 'C1', 0, 'Chorus content'),
      makeSlide(20, 'V1', 1, 'Verse 1'),
      makeSlide(30, 'V2', 2, 'Verse 2'),
    ]
    const result = expandSongSlidesWithChoruses(slides)
    // C1(0), V1(1), C1(0), V2(2), C1(0)
    expect(result.map((s) => s.originalIndex)).toEqual([0, 1, 0, 2, 0])
  })

  it('handles single slide with label', () => {
    const slides = [makeSlide(1, 'V1', 0)]
    const result = expandSongSlidesWithChoruses(slides)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('V1')
  })
})

describe('getOriginalSlideIndex', () => {
  it('returns originalIndex for valid expanded index', () => {
    const expanded = [
      { id: 1, content: '', sortOrder: 0, label: 'C1', originalIndex: 0 },
      { id: 2, content: '', sortOrder: 1, label: 'V1', originalIndex: 1 },
      { id: 1, content: '', sortOrder: 0, label: 'C1', originalIndex: 0 },
    ]
    expect(getOriginalSlideIndex(expanded, 0)).toBe(0)
    expect(getOriginalSlideIndex(expanded, 1)).toBe(1)
    expect(getOriginalSlideIndex(expanded, 2)).toBe(0)
  })

  it('returns 0 for negative index', () => {
    const expanded = [
      { id: 1, content: '', sortOrder: 0, label: 'C1', originalIndex: 0 },
    ]
    expect(getOriginalSlideIndex(expanded, -1)).toBe(0)
  })

  it('returns 0 for out-of-bounds index', () => {
    const expanded = [
      { id: 1, content: '', sortOrder: 0, label: 'C1', originalIndex: 0 },
    ]
    expect(getOriginalSlideIndex(expanded, 99)).toBe(0)
  })
})

describe('generateExpandedPresentationOrder', () => {
  it('returns empty string for empty slides', () => {
    expect(generateExpandedPresentationOrder([])).toBe('')
  })

  it('returns empty string when no labels exist', () => {
    const slides = [makeSlide(1, null, 0), makeSlide(2, null, 1)]
    expect(generateExpandedPresentationOrder(slides)).toBe('')
  })

  it('returns labels without chorus insertion when no choruses', () => {
    const slides = [
      makeSlide(1, 'V1', 0),
      makeSlide(2, 'V2', 1),
      makeSlide(3, 'V3', 2),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('V1 V2 V3')
  })

  it('returns labels without chorus insertion when no verses', () => {
    const slides = [makeSlide(1, 'C1', 0), makeSlide(2, 'C2', 1)]
    expect(generateExpandedPresentationOrder(slides)).toBe('C1 C2')
  })

  it('generates expanded order with chorus insertions', () => {
    // Input: C1, V1, V2, V3, C2
    // Expected: "C1 V1 C1 V2 C1 V3 C2"
    const slides = [
      makeSlide(1, 'C1', 0),
      makeSlide(2, 'V1', 1),
      makeSlide(3, 'V2', 2),
      makeSlide(4, 'V3', 3),
      makeSlide(5, 'C2', 4),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe(
      'C1 V1 C1 V2 C1 V3 C2',
    )
  })

  it('does not insert chorus label before next chorus', () => {
    const slides = [
      makeSlide(1, 'C1', 0),
      makeSlide(2, 'V1', 1),
      makeSlide(3, 'C2', 2),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('C1 V1 C2')
  })

  it('updates chorus label when new chorus encountered', () => {
    // Input: C1, V1, V2, C2, V3
    // Expected: "C1 V1 C1 V2 C2 V3 C2"
    const slides = [
      makeSlide(1, 'C1', 0),
      makeSlide(2, 'V1', 1),
      makeSlide(3, 'V2', 2),
      makeSlide(4, 'C2', 3),
      makeSlide(5, 'V3', 4),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe(
      'C1 V1 C1 V2 C2 V3 C2',
    )
  })

  it('skips slides without labels in the order string', () => {
    const slides = [
      makeSlide(1, 'C1', 0),
      makeSlide(2, null, 1),
      makeSlide(3, 'V1', 2),
    ]
    expect(generateExpandedPresentationOrder(slides)).toBe('C1 V1 C1')
  })
})
