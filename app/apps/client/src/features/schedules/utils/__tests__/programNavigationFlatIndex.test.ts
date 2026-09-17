import { describe, expect, it } from 'vitest'

import type { TemporaryContent } from '~/features/presentation'
import type { ScheduleItem } from '../../types'
import { programNavigationFlatIndex } from '../programNavigationFlatIndex'
import { buildScheduleFlatItems } from '../scheduleFlatItems'

function baseItem(id: number): ScheduleItem {
  return {
    id,
    scheduleId: 1,
    itemType: 'song',
    songId: null,
    song: null,
    slides: [],
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

function songItem(id: number, songId: number, slideCount = 3): ScheduleItem {
  return {
    ...baseItem(id),
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
  }
}

function passageItem(id: number, verseIds: number[]): ScheduleItem {
  return {
    ...baseItem(id),
    itemType: 'bible_passage',
    biblePassageReference: 'Ioan 3:16-17',
    biblePassageVerses: verseIds.map((verseId, i) => ({
      id: verseId + 1000,
      verseId,
      reference: `Ioan 3:${16 + i}`,
      text: `verse ${verseId}`,
      sortOrder: i,
    })),
  }
}

function announcementItem(id: number): ScheduleItem {
  return {
    ...baseItem(id),
    itemType: 'slide',
    slideType: 'announcement',
    slideContent: '<p>Anunt</p>',
  }
}

function song(
  songId: number,
  currentSlideIndex: number,
  scheduleId?: number,
  scheduleItemIndex?: number,
): TemporaryContent {
  return {
    type: 'song',
    data: {
      songId,
      title: `Song ${songId}`,
      slides: [],
      currentSlideIndex,
      scheduleId,
      scheduleItemIndex,
    },
  }
}

function bibleVerse(verseId: number): TemporaryContent {
  return {
    type: 'bible',
    data: {
      verseId,
      reference: 'Ioan 3:17',
      text: 'verse',
      translationAbbreviation: 'VDC',
      bookName: 'Ioan',
      translationId: 1,
      bookId: 43,
      bookCode: 'JHN',
      chapter: 3,
      currentVerseIndex: 16,
    },
  }
}

// Song 5 (0-2), song 6 (3-5), passage (6-7), song 5 again (8-10), announcement (11).
const flatItems = buildScheduleFlatItems([
  songItem(1, 5),
  songItem(2, 6),
  passageItem(3, [316, 317]),
  songItem(4, 5),
  announcementItem(5),
])

describe('programNavigationFlatIndex', () => {
  it("is the live step while the program's content is on the projector", () => {
    expect(programNavigationFlatIndex(song(6, 1, 7, 4), 7, flatItems, -1)).toBe(
      4,
    )
  })

  it("is the step showing a song's slide presented on its own", () => {
    expect(programNavigationFlatIndex(song(6, 1), 7, flatItems, -1)).toBe(4)
  })

  it('is the verse step of a verse-by-verse passage for a verse from the Bible page', () => {
    expect(programNavigationFlatIndex(bibleVerse(317), 7, flatItems, -1)).toBe(
      7,
    )
  })

  it("matches another program's passage verse by the verse it shows", () => {
    const passage: TemporaryContent = {
      type: 'bible_passage',
      data: {
        translationId: 0,
        translationAbbreviation: 'VDC',
        bookCode: '',
        bookName: 'Ioan',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 17,
        verses: [
          { verseId: 316, verse: 16, text: 'a' },
          { verseId: 317, verse: 17, text: 'b' },
        ],
        currentVerseIndex: 0,
        scheduleId: 8,
        scheduleItemIndex: 0,
      },
    }
    expect(programNavigationFlatIndex(passage, 7, flatItems, -1)).toBe(6)
  })

  it('is -1 for content the program does not hold', () => {
    expect(programNavigationFlatIndex(song(9, 0), 7, flatItems, -1)).toBe(-1)
    expect(programNavigationFlatIndex(bibleVerse(999), 7, flatItems, -1)).toBe(
      -1,
    )
    expect(programNavigationFlatIndex(song(6, 3), 7, flatItems, -1)).toBe(-1)
  })

  it('is -1 when nothing is on screen or no program is walked', () => {
    expect(programNavigationFlatIndex(null, 7, flatItems, -1)).toBe(-1)
    expect(programNavigationFlatIndex(song(6, 1), null, flatItems, -1)).toBe(-1)
  })

  it('never takes an announcement for a step of another program', () => {
    const announcement: TemporaryContent = {
      type: 'announcement',
      data: { content: '<p>Anunt</p>', scheduleId: 8, scheduleItemIndex: 11 },
    }
    expect(programNavigationFlatIndex(announcement, 7, flatItems, -1)).toBe(-1)
  })

  describe('a song the program holds twice', () => {
    it('is the first occurrence while the program has no known position', () => {
      expect(programNavigationFlatIndex(song(5, 1), 7, flatItems, -1)).toBe(1)
    })

    it('is the occurrence the program was last inside', () => {
      expect(programNavigationFlatIndex(song(5, 0), 7, flatItems, 2)).toBe(0)
      expect(programNavigationFlatIndex(song(5, 2), 7, flatItems, 9)).toBe(10)
    })

    it('is the first occurrence after where the program last was', () => {
      expect(programNavigationFlatIndex(song(5, 1), 7, flatItems, 7)).toBe(9)
    })

    it('is the first occurrence once the program has gone past every one', () => {
      expect(programNavigationFlatIndex(song(5, 1), 7, flatItems, 11)).toBe(1)
    })
  })
})
