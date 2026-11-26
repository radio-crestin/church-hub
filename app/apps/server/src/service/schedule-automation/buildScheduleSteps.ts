import { expandSongSlidesWithChoruses } from '../presentation/expand-song-slides'
import { isBackgroundVideo } from '../schedule-items/isBackgroundVideo'
import { flattenScheduleItems } from '../schedules/flattenScheduleItems'
import type { ScheduleItem } from '../schedules/types'
import { deckSteps } from '../slides-deck/deckSteps'
import type { SlideDeck } from '../slides-deck/types'

export type ScheduleStepType =
  | 'slide'
  | 'verse'
  | 'entry'
  | 'announcement'
  | 'scene'
  | 'video'
  | 'deck'

/**
 * One presentable step of a presentation: a slide, verse, entry, slide item,
 * video, or a Slides item's slide with its animations up to a click (`deck`,
 * one step per slide and click: deckSteps). A music item is no step: it starts playing as the presentation
 * reaches the step after it (see `musicCue`); nor is a background video,
 * shown behind the steps after it (see `stepBackground`).
 */
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
  // A presentation inside it runs its items in its place.
  for (const item of flattenScheduleItems(items)) {
    if (item.itemType === 'song') {
      expandSongSlidesWithChoruses(item.slides).forEach((_, index) => {
        steps.push({ item, type: 'slide', index })
      })
    } else if (item.itemType === 'bible_passage') {
      item.biblePassageVerses.forEach((_, index) => {
        steps.push({ item, type: 'verse', index })
      })
    } else if (
      item.slideType === 'versete_tineri' ||
      item.itemType === 'verses'
    ) {
      item.verseteTineriEntries.forEach((_, index) => {
        steps.push({ item, type: 'entry', index })
      })
    } else if (item.slideType === 'scene') {
      steps.push({ item, type: 'scene', index: 0 })
    } else if (item.itemType === 'video') {
      if (item.video && !isBackgroundVideo(item))
        steps.push({ item, type: 'video', index: 0 })
    } else if (item.itemType === 'slides') {
      deckSteps(item.itemConfig as SlideDeck).forEach((_, index) => {
        steps.push({ item, type: 'deck', index })
      })
    } else if (item.itemType === 'slide') {
      steps.push({ item, type: 'announcement', index: 0 })
    }
  }
  return steps
}
