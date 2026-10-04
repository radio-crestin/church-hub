import { describe, expect, it } from 'vitest'

import { splitReadingList } from '../splitReadingList'

describe('splitReadingList', () => {
  it('splits readings on commas', () => {
    expect(splitReadingList('Ana - Ioan 3:16, Ion - Psalmii 23:1')).toEqual([
      'Ana - Ioan 3:16',
      'Ion - Psalmii 23:1',
    ])
  })

  it('keeps a verse list with its reading', () => {
    expect(
      splitReadingList('Ana - Ioan 3:16-18,20, Ion - Psalmii 23:1, 3-4'),
    ).toEqual(['Ana - Ioan 3:16-18,20', 'Ion - Psalmii 23:1,3-4'])
  })

  it('keeps a lone first part as its own reading', () => {
    expect(splitReadingList('16, Ana - Ioan 3:16')).toEqual([
      '16',
      'Ana - Ioan 3:16',
    ])
  })
})
