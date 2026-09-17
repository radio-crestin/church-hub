import { describe, expect, it } from 'vitest'

import type { ScheduleItem } from '../../types'
import { liveProgramItemForSong } from '../liveProgramItemForSong'
import { buildScheduleFlatItems } from '../scheduleFlatItems'

function songItem(id: number, songId: number, slideCount = 2): ScheduleItem {
  return {
    id,
    scheduleId: 1,
    itemType: 'song',
    songId,
    song: {
      id: songId,
      title: `Song ${songId}`,
      categoryName: null,
      tagNames: [],
    },
    slides: Array.from({ length: slideCount }, (_, i) => ({
      id: songId * 10 + i,
      songId,
      content: `slide ${i + 1}`,
      chords: null,
      sortOrder: i,
      label: null,
      notes: null,
      styleOverrides: null,
      createdAt: 0,
      updatedAt: 0,
    })),
    keyLine: null,
    isSung: false,
    sungAt: null,
    slideType: null,
    slideContent: null,
    biblePassageReference: null,
    biblePassageTranslation: null,
    biblePassageVerses: [],
    verseteTineriEntries: [],
    obsSceneName: null,
    sortOrder: id,
    createdAt: 0,
    updatedAt: 0,
  }
}

// Song 5, song 6, then song 5 again. Flat run: 0-1 song 5, 2-3 song 6, 4-5 song 5.
const items = [songItem(1, 5), songItem(2, 6), songItem(3, 5)]
const flatItems = buildScheduleFlatItems(items)

describe('liveProgramItemForSong', () => {
  it('leaves the song on its own while the program is not on the projector', () => {
    expect(
      liveProgramItemForSong(
        { isScheduleLive: false, items, flatItems, currentFlatIndex: -1 },
        6,
      ),
    ).toBeNull()
  })

  it("is the song's item while the program is live on another item", () => {
    expect(
      liveProgramItemForSong(
        { isScheduleLive: true, items, flatItems, currentFlatIndex: 0 },
        6,
      ),
    ).toBe(items[1])
  })

  it('prefers the occurrence already on the projector', () => {
    expect(
      liveProgramItemForSong(
        { isScheduleLive: true, items, flatItems, currentFlatIndex: 5 },
        5,
      ),
    ).toBe(items[2])
  })

  it('is null for a song the live program does not hold', () => {
    expect(
      liveProgramItemForSong(
        { isScheduleLive: true, items, flatItems, currentFlatIndex: 0 },
        9,
      ),
    ).toBeNull()
  })
})
