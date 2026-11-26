import type { SlideDeck } from '~/features/slides-deck/types'
import type { MediaItemType } from '../media-items/types'
import type { AddToScheduleInput, ScheduleItem } from '../types'

const MEDIA_TYPES: readonly string[] = [
  'music',
  'video',
  'verses',
] satisfies MediaItemType[]

/**
 * What adds a copy of `item` to another presentation, or null for the old
 * `bible_passage` items, which can no longer be created. Per-item settings
 * (slide time, template, MIDI) stay with the original.
 */
export function scheduleItemToAddInput(
  item: ScheduleItem,
): AddToScheduleInput | null {
  if (item.itemType === 'song' && item.songId) return { songId: item.songId }
  if (item.itemType === 'slides' && item.itemConfig) {
    return { slides: item.itemConfig as SlideDeck }
  }
  if (MEDIA_TYPES.includes(item.itemType) && item.itemConfig) {
    return {
      media: {
        itemType: item.itemType as MediaItemType,
        itemConfig: item.itemConfig,
      },
    }
  }
  if (item.itemType !== 'slide') return null
  if (item.slideType === 'scene' && item.obsSceneName) {
    return { slideType: 'scene', obsSceneName: item.obsSceneName }
  }
  if (item.slideType === 'versete_tineri') {
    const entries = item.allVerseteTineriEntries ?? item.verseteTineriEntries
    return {
      verseteTineriEntries: entries.map((entry) => ({
        personName: entry.personName,
        translationId: entry.translationId,
        bookCode: entry.bookCode,
        bookName: entry.bookName,
        startChapter: entry.startChapter,
        startVerse: entry.startVerse,
        endChapter: entry.endChapter,
        endVerse: entry.endVerse,
      })),
    }
  }
  return {
    slideType: item.slideType ?? 'announcement',
    slideContent: item.slideContent ?? '',
  }
}
