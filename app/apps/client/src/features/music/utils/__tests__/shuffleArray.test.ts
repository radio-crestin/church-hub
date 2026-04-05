import { describe, expect, it } from 'vitest'

import { shuffleArray } from '../shuffleArray'

describe('music/utils/shuffleArray', () => {
  it('returns a new array (does not mutate original)', () => {
    const original = [1, 2, 3, 4, 5]
    const result = shuffleArray(original)
    expect(result).not.toBe(original)
    expect(original).toEqual([1, 2, 3, 4, 5])
  })

  it('returns array with same length', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffleArray(arr)).toHaveLength(5)
  })

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffleArray(arr)
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('returns empty array for empty input', () => {
    expect(shuffleArray([])).toEqual([])
  })

  it('returns single element array unchanged', () => {
    expect(shuffleArray([42])).toEqual([42])
  })

  it('works with string arrays', () => {
    const arr = ['a', 'b', 'c']
    const result = shuffleArray(arr)
    expect(result).toHaveLength(3)
    expect(result.sort()).toEqual(['a', 'b', 'c'])
  })

  it('produces different orderings (probabilistic)', () => {
    const arr = Array.from({ length: 20 }, (_, i) => i)
    const results = new Set<string>()
    for (let i = 0; i < 10; i++) {
      results.add(JSON.stringify(shuffleArray(arr)))
    }
    // With 20 elements and 10 trials, extremely unlikely to get identical orderings
    expect(results.size).toBeGreaterThan(1)
  })
})
