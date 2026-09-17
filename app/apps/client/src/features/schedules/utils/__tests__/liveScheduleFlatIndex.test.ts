import { describe, expect, it } from 'vitest'

import type { TemporaryContent } from '~/features/presentation'
import { liveScheduleFlatIndex } from '../liveScheduleFlatIndex'

function song(scheduleId?: number, scheduleItemIndex?: number) {
  return {
    type: 'song',
    data: {
      songId: 5,
      title: 'Cantare',
      keyLine: null,
      slides: [],
      currentSlideIndex: 1,
      scheduleId,
      scheduleItemIndex,
    },
  } as unknown as TemporaryContent
}

describe('liveScheduleFlatIndex', () => {
  it("is the live step's place in the program the content came from", () => {
    expect(liveScheduleFlatIndex(song(7, 4), 7)).toBe(4)
  })

  it('is -1 for a song presented on its own', () => {
    expect(liveScheduleFlatIndex(song(), 7)).toBe(-1)
  })

  it('is -1 for a step of another program', () => {
    expect(liveScheduleFlatIndex(song(8, 4), 7)).toBe(-1)
  })

  it('is -1 when no program is selected or nothing is live', () => {
    expect(liveScheduleFlatIndex(song(7, 4), null)).toBe(-1)
    expect(liveScheduleFlatIndex(null, 7)).toBe(-1)
  })

  it('is -1 for program content without a position', () => {
    expect(liveScheduleFlatIndex(song(7), 7)).toBe(-1)
  })
})
