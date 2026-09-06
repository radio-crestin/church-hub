import type { TemporaryContent } from '~/features/presentation'

/**
 * What the projector is showing right now, reduced to the bits a program list
 * needs to highlight the matching sub-item. `scheduleItemIndex` is the exact
 * position in the flat program list, which is what makes the highlight precise
 * even when the same song appears twice in a program.
 */
export type PresentedScheduleInfo =
  | {
      type: 'song'
      songId: number
      slideIndex: number
      scheduleId?: number
      scheduleItemIndex: number
    }
  | {
      type: 'bible_passage'
      currentVerseIndex: number
      scheduleId?: number
      scheduleItemIndex: number
    }
  | {
      type: 'versete_tineri'
      currentEntryIndex: number
      scheduleId?: number
      scheduleItemIndex: number
    }
  | { type: 'announcement'; scheduleId?: number; scheduleItemIndex: number }
  | {
      type: 'scene'
      obsSceneName: string
      scheduleId?: number
      scheduleItemIndex: number
    }

/**
 * Reads the live presentation state into a shape the program panels can match
 * against. Content kinds that can never come from a program (a single Bible
 * verse, a screen share) resolve to `null`.
 */
export function derivePresentedScheduleInfo(
  temporaryContent: TemporaryContent | null | undefined,
): PresentedScheduleInfo | null {
  if (!temporaryContent) return null

  switch (temporaryContent.type) {
    case 'song':
      return {
        type: 'song',
        songId: temporaryContent.data.songId,
        slideIndex: temporaryContent.data.currentSlideIndex,
        scheduleId: temporaryContent.data.scheduleId,
        scheduleItemIndex: temporaryContent.data.scheduleItemIndex ?? -1,
      }
    case 'bible_passage':
      return {
        type: 'bible_passage',
        currentVerseIndex: temporaryContent.data.currentVerseIndex,
        scheduleId: temporaryContent.data.scheduleId,
        scheduleItemIndex: temporaryContent.data.scheduleItemIndex ?? -1,
      }
    case 'versete_tineri':
      return {
        type: 'versete_tineri',
        currentEntryIndex: temporaryContent.data.currentEntryIndex,
        scheduleId: temporaryContent.data.scheduleId,
        scheduleItemIndex: temporaryContent.data.scheduleItemIndex ?? -1,
      }
    case 'announcement':
      return {
        type: 'announcement',
        scheduleId: temporaryContent.data.scheduleId,
        scheduleItemIndex: temporaryContent.data.scheduleItemIndex ?? -1,
      }
    case 'scene':
      return {
        type: 'scene',
        obsSceneName: temporaryContent.data.obsSceneName,
        scheduleId: temporaryContent.data.scheduleId,
        scheduleItemIndex: temporaryContent.data.scheduleItemIndex ?? -1,
      }
    default:
      return null
  }
}
