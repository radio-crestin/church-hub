import type { ScheduleWithItems } from '../../schedules/types'
import type { ChurchProgramData, ExportedScheduleItem } from '../types'

/**
 * Generates a ChurchProgram JSON structure from a schedule
 */
export function generateChurchProgramJson(
  schedule: ScheduleWithItems,
): ChurchProgramData {
  const items: ExportedScheduleItem[] = schedule.items.map((item) => {
    // Song item
    if (item.itemType === 'song' && item.song) {
      return {
        itemType: 'song' as const,
        sortOrder: item.sortOrder,
        song: {
          title: item.song.title,
          author: null,
          copyright: null,
          ccli: null,
          key: null,
          tempo: null,
          slides: item.slides.map((slide) => ({
            content: slide.content,
            label: slide.label,
            sortOrder: slide.sortOrder,
          })),
        },
      }
    }

    // Bible passage item
    if (item.itemType === 'bible_passage') {
      return {
        itemType: 'bible_passage' as const,
        sortOrder: item.sortOrder,
        biblePassage: {
          reference: item.biblePassageReference ?? '',
          translationAbbreviation: item.biblePassageTranslation ?? '',
          verses: item.biblePassageVerses.map((verse) => ({
            verseId: verse.verseId,
            reference: verse.reference,
            text: verse.text,
            sortOrder: verse.sortOrder,
          })),
        },
      }
    }

    // Slide item (announcement or versete_tineri)
    const exportedItem: ExportedScheduleItem = {
      itemType: 'slide' as const,
      sortOrder: item.sortOrder,
      slideType: item.slideType ?? undefined,
      slideContent: item.slideContent ?? undefined,
    }

    // Add versete tineri entries if present
    if (
      item.slideType === 'versete_tineri' &&
      item.verseteTineriEntries.length > 0
    ) {
      exportedItem.verseteTineriEntries = item.verseteTineriEntries.map(
        (entry) => ({
          personName: entry.personName,
          translationId: entry.translationId,
          bookCode: entry.bookCode,
          bookName: entry.bookName,
          reference: entry.reference,
          text: entry.text,
          startChapter: entry.startChapter,
          startVerse: entry.startVerse,
          endChapter: entry.endChapter,
          endVerse: entry.endVerse,
          sortOrder: entry.sortOrder,
        }),
      )
    }

    return exportedItem
  })

  return {
    version: 1,
    type: 'churchprogram',
    schedule: {
      title: schedule.title,
      description: schedule.description,
    },
    items,
  }
}

/**
 * Serializes a ChurchProgram to a JSON string
 */
export function serializeChurchProgram(data: ChurchProgramData): string {
  return JSON.stringify(data, null, 2)
}
