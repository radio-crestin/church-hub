import { describe, expect, it } from 'vitest'

import { adoptSavedSlideIds } from '../adoptSavedSlideIds'

interface DraftSlide {
  id: string | number
  content: string
}

describe('adoptSavedSlideIds', () => {
  it('gives a new slide the id it was stored under', () => {
    const draft: DraftSlide[] = [
      { id: 10, content: 'One' },
      { id: 'temp-1', content: 'Copy' },
      { id: 11, content: 'Two' },
    ]

    const result = adoptSavedSlideIds(draft, draft, [
      { id: 10 },
      { id: 12 },
      { id: 11 },
    ])

    expect(result.map((slide) => slide.id)).toEqual([10, 12, 11])
  })

  it('keeps text typed while the save was in flight', () => {
    const sent: DraftSlide[] = [
      { id: 10, content: 'One' },
      { id: 'temp-1', content: 'Cop' },
    ]
    const draft: DraftSlide[] = [
      { id: 10, content: 'One' },
      { id: 'temp-1', content: 'Copy, typed on' },
    ]

    const result = adoptSavedSlideIds(draft, sent, [{ id: 10 }, { id: 12 }])

    expect(result).toEqual([
      { id: 10, content: 'One' },
      { id: 12, content: 'Copy, typed on' },
    ])
  })

  it('leaves a slide added after the save was sent for the next save', () => {
    const sent: DraftSlide[] = [{ id: 'temp-1', content: 'Copy' }]
    const draft: DraftSlide[] = [
      { id: 'temp-1', content: 'Copy' },
      { id: 'temp-2', content: 'Newer' },
    ]

    const result = adoptSavedSlideIds(draft, sent, [{ id: 12 }])

    expect(result.map((slide) => slide.id)).toEqual([12, 'temp-2'])
  })

  it('follows a stored slide the server had to store again', () => {
    const draft: DraftSlide[] = [{ id: 10, content: 'One' }]

    const result = adoptSavedSlideIds(draft, draft, [{ id: 20 }])

    expect(result[0].id).toBe(20)
  })

  it('returns the same draft when every id already matches', () => {
    const draft: DraftSlide[] = [
      { id: 10, content: 'One' },
      { id: 11, content: 'Two' },
    ]

    expect(adoptSavedSlideIds(draft, draft, [{ id: 10 }, { id: 11 }])).toBe(
      draft,
    )
  })

  it('does not pair slides when the saved list has a different length', () => {
    const draft: DraftSlide[] = [
      { id: 'temp-1', content: 'Copy' },
      { id: 11, content: 'Two' },
    ]

    expect(adoptSavedSlideIds(draft, draft, [{ id: 12 }])).toBe(draft)
  })
})
