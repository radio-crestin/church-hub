import { expandSongSlidesWithChoruses } from '../presentation/expand-song-slides'
import type { ScheduleItem } from '../schedules/types'

export type ScheduleStepType =
  | 'slide'
  | 'verse'
  | 'entry'
  | 'announcement'
  | 'scene'

/** One presentable step of a presentation: a slide, verse, entry or slide item. */
export interface ScheduleStep {
  item: ScheduleItem
  type: ScheduleStepType
  /** Index of this step within its item. */
  index: number
}

/**
 * The running order of a presentation, one step per slide, verse or entry.
 * Built exactly as the client's `buildScheduleFlatItems`: a step's position
 * here is the `scheduleItemIndex` every page lights its rows by.
 */
export function buildScheduleSteps(items: ScheduleItem[]): ScheduleStep[] {
  const steps: ScheduleStep[] = []
  for (const item of items) {
    if (item.itemType === 'song') {
      expandSongSlidesWithChoruses(item.slides).forEach((_, index) => {
        steps.push({ item, type: 'slide', index })
      })
    } else if (item.itemType === 'bible_passage') {
      item.biblePassageVerses.forEach((_, index) => {
        steps.push({ item, type: 'verse', index })
      })
    } else if (item.slideType === 'versete_tineri') {
      item.verseteTineriEntries.forEach((_, index) => {
        steps.push({ item, type: 'entry', index })
      })
    } else if (item.slideType === 'scene') {
      steps.push({ item, type: 'scene', index: 0 })
    } else {
      steps.push({ item, type: 'announcement', index: 0 })
    }
  }
  return steps
}
