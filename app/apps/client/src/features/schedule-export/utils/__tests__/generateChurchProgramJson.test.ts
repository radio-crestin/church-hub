import { describe, expect, it } from 'vitest'

import type { ScheduleItem, ScheduleWithItems } from '../../../schedules/types'
import {
  generateChurchProgramJson,
  serializeChurchProgram,
} from '../generateChurchProgramJson'

function makeScheduleItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 1,
    scheduleId: 1,
    itemType: 'song',
    songId: 1,
    song: { id: 1, title: 'Test Song', categoryName: null },
    slides: [
      {
        id: 1,
        songId: 1,
        content: '<p>Verse 1</p>',
        sortOrder: 0,
        label: 'V1',
        isChorus: false,
        chordsData: null,
        createdAt: 0,
        updatedAt: 0,
      },
    ],
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

function makeSchedule(items: ScheduleItem[] = []): ScheduleWithItems {
  return {
    id: 1,
    title: 'Sunday Service',
    description: 'Weekly service',
    itemCount: items.length,
    songCount: items.filter((i) => i.itemType === 'song').length,
    createdAt: 0,
    updatedAt: 0,
    items,
  }
}

describe('schedule-export/utils/generateChurchProgramJson', () => {
  describe('generateChurchProgramJson', () => {
    it('generates correct top-level structure', () => {
      const result = generateChurchProgramJson(makeSchedule())
      expect(result.version).toBe(1)
      expect(result.type).toBe('churchprogram')
      expect(result.schedule.title).toBe('Sunday Service')
      expect(result.schedule.description).toBe('Weekly service')
    })

    it('exports song items', () => {
      const schedule = makeSchedule([makeScheduleItem()])
      const result = generateChurchProgramJson(schedule)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].itemType).toBe('song')
      expect(result.items[0].song?.title).toBe('Test Song')
      expect(result.items[0].song?.slides).toHaveLength(1)
    })

    it('exports bible passage items', () => {
      const item = makeScheduleItem({
        itemType: 'bible_passage',
        songId: null,
        song: null,
        biblePassageReference: 'John 3:16',
        biblePassageTranslation: 'VDCC',
        biblePassageVerses: [
          {
            id: 1,
            verseId: 100,
            reference: 'John 3:16',
            text: 'For God so loved...',
            sortOrder: 0,
          },
        ],
      })
      const result = generateChurchProgramJson(makeSchedule([item]))
      expect(result.items[0].itemType).toBe('bible_passage')
      expect(result.items[0].biblePassage?.reference).toBe('John 3:16')
      expect(result.items[0].biblePassage?.verses).toHaveLength(1)
    })

    it('exports slide items with announcement type', () => {
      const item = makeScheduleItem({
        itemType: 'slide',
        songId: null,
        song: null,
        slideType: 'announcement',
        slideContent: '<p>Welcome</p>',
      })
      const result = generateChurchProgramJson(makeSchedule([item]))
      expect(result.items[0].itemType).toBe('slide')
      expect(result.items[0].slideType).toBe('announcement')
      expect(result.items[0].slideContent).toBe('<p>Welcome</p>')
    })

    it('exports versete tineri entries', () => {
      const item = makeScheduleItem({
        itemType: 'slide',
        songId: null,
        song: null,
        slideType: 'versete_tineri',
        verseteTineriEntries: [
          {
            id: 1,
            personName: 'Ion',
            translationId: 1,
            bookCode: 'JHN',
            bookName: 'Ioan',
            reference: 'Ioan 3:16',
            text: 'For God...',
            startChapter: 3,
            startVerse: 16,
            endChapter: 3,
            endVerse: 16,
            sortOrder: 0,
          },
        ],
      })
      const result = generateChurchProgramJson(makeSchedule([item]))
      expect(result.items[0].verseteTineriEntries).toHaveLength(1)
      expect(result.items[0].verseteTineriEntries![0].personName).toBe('Ion')
    })

    it('handles empty schedule', () => {
      const result = generateChurchProgramJson(makeSchedule([]))
      expect(result.items).toHaveLength(0)
    })

    it('sets song metadata fields to null', () => {
      const schedule = makeSchedule([makeScheduleItem()])
      const result = generateChurchProgramJson(schedule)
      const song = result.items[0].song!
      expect(song.author).toBeNull()
      expect(song.copyright).toBeNull()
      expect(song.ccli).toBeNull()
      expect(song.key).toBeNull()
      expect(song.tempo).toBeNull()
    })
  })

  describe('serializeChurchProgram', () => {
    it('serializes to formatted JSON', () => {
      const data = generateChurchProgramJson(makeSchedule())
      const json = serializeChurchProgram(data)
      expect(() => JSON.parse(json)).not.toThrow()
      // Should be pretty-printed
      expect(json).toContain('\n')
    })

    it('produces valid JSON that can be re-parsed', () => {
      const data = generateChurchProgramJson(makeSchedule([makeScheduleItem()]))
      const json = serializeChurchProgram(data)
      const reparsed = JSON.parse(json)
      expect(reparsed.type).toBe('churchprogram')
      expect(reparsed.items).toHaveLength(1)
    })
  })
})
