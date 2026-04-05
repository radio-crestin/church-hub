import { describe, expect, it, vi } from 'vitest'

// Mock the expandSongSlidesWithChoruses dependency
vi.mock('../../../songs/utils/expandSongSlides', () => ({
  expandSongSlidesWithChoruses: vi.fn((slides) => slides),
}))

import type { ScheduleItem } from '../../types'
import { generateScheduleText } from '../generateScheduleText'

function makeSongItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 1,
    scheduleId: 1,
    itemType: 'song',
    songId: 42,
    song: { id: 42, title: 'Amazing Grace', categoryName: null },
    slides: [],
    slideType: null,
    slideContent: null,
    biblePassageReference: null,
    biblePassageTranslation: null,
    biblePassageVerses: [],
    verseteTineriEntries: [],
    obsSceneName: null,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeBibleItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    ...makeSongItem(),
    itemType: 'bible_passage',
    songId: null,
    song: null,
    biblePassageReference: 'Ioan 3:16 - VDCC',
    biblePassageVerses: [],
    ...overrides,
  }
}

function makeAnnouncementItem(
  content: string,
  overrides: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    ...makeSongItem(),
    itemType: 'slide',
    songId: null,
    song: null,
    slideType: 'announcement',
    slideContent: `<p>${content}</p>`,
    ...overrides,
  }
}

function makeVerseteTineriItem(
  overrides: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    ...makeSongItem(),
    itemType: 'slide',
    songId: null,
    song: null,
    slideType: 'versete_tineri',
    slideContent: null,
    verseteTineriEntries: [
      {
        id: 1,
        personName: 'Ion Popescu',
        translationId: 1,
        bookCode: 'JHN',
        bookName: 'Ioan',
        reference: 'Ioan 3:16',
        text: 'For God so loved...',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 16,
        sortOrder: 0,
      },
    ],
    ...overrides,
  }
}

function makeSceneItem(
  sceneName: string,
  overrides: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    ...makeSongItem(),
    itemType: 'slide',
    songId: null,
    song: null,
    slideType: 'scene',
    slideContent: null,
    obsSceneName: sceneName,
    ...overrides,
  }
}

describe('schedules/utils/generateScheduleText', () => {
  it('generates text for a song item', () => {
    const result = generateScheduleText([makeSongItem()])
    expect(result).toContain('Amazing Grace #42 [S]')
  })

  it('uses custom songSuffix', () => {
    const result = generateScheduleText([makeSongItem()], {
      songSuffix: 'C',
    })
    expect(result).toContain('Amazing Grace #42 [C]')
  })

  it('generates text for a bible passage', () => {
    const result = generateScheduleText([makeBibleItem()])
    // Should strip the " - VDCC" translation suffix
    expect(result).toContain('Ioan 3:16 [V]')
  })

  it('generates text for announcement', () => {
    const result = generateScheduleText([
      makeAnnouncementItem('Welcome to church'),
    ])
    expect(result).toContain('Welcome to church [A]')
  })

  it('generates text for versete tineri with entries', () => {
    const result = generateScheduleText([makeVerseteTineriItem()])
    expect(result).toContain('Ion Popescu - Ioan 3:16 [VT]')
  })

  it('generates text for scene item', () => {
    const result = generateScheduleText([makeSceneItem('Camera 1')])
    expect(result).toContain('Camera 1 [SC]')
  })

  it('generates format help lines when items are empty', () => {
    const result = generateScheduleText([], {
      formatHelpLines: ['Use [S] for songs', 'Use [V] for verses'],
    })
    expect(result).toContain('# Use [S] for songs')
    expect(result).toContain('# Use [V] for verses')
  })

  it('does not generate format help when items exist', () => {
    const result = generateScheduleText([makeSongItem()], {
      formatHelpLines: ['Help line'],
    })
    expect(result).not.toContain('# Help line')
  })

  it('generates reference section for items', () => {
    const result = generateScheduleText([makeSongItem()])
    expect(result).toContain('--- Schedule Content ---')
    expect(result).toContain('--- End Schedule Content ---')
  })

  it('handles empty items array', () => {
    const result = generateScheduleText([])
    expect(result).toBe('')
  })

  it('generates multiple items', () => {
    const items = [
      makeSongItem(),
      makeBibleItem(),
      makeAnnouncementItem('Hello'),
    ]
    const result = generateScheduleText(items)
    expect(result).toContain('[S]')
    expect(result).toContain('[V]')
    expect(result).toContain('[A]')
  })
})
