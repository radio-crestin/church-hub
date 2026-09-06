import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import type { ScheduleItem } from '../types'

/** Which kind of sub-item a flat entry points at. */
export type ScheduleFlatItemType =
  | 'slide'
  | 'verse'
  | 'entry'
  | 'announcement'
  | 'scene'

/**
 * One presentable step of a program. A program item is rarely a single step:
 * a song is one step per (chorus-expanded) slide, a passage one per verse, a
 * Versete Tineri slide one per entry. Announcements and OBS scenes are a single
 * step each.
 */
export interface ScheduleFlatItem {
  item: ScheduleItem
  type: ScheduleFlatItemType
  /** Index of this step *within* its program item. */
  index: number
}

/** How many presentable steps a single program item contributes. */
export function countScheduleItemSteps(item: ScheduleItem): number {
  if (item.itemType === 'song') {
    return expandSongSlidesWithChoruses(item.slides).length
  }
  if (item.itemType === 'bible_passage') {
    return item.biblePassageVerses.length
  }
  if (item.itemType === 'slide' && item.slideType === 'versete_tineri') {
    return item.verseteTineriEntries.length
  }
  // announcement, scene — a single step
  return 1
}

/**
 * Flattens a program into the running order the operator actually walks
 * through with next/prev. The position in this list is what travels to the
 * server as `scheduleItemIndex`, so every consumer must build it the same way.
 */
export function buildScheduleFlatItems(
  items: ScheduleItem[],
): ScheduleFlatItem[] {
  const result: ScheduleFlatItem[] = []

  items.forEach((item) => {
    if (item.itemType === 'song') {
      expandSongSlidesWithChoruses(item.slides).forEach((_, index) => {
        result.push({ item, type: 'slide', index })
      })
    } else if (item.itemType === 'bible_passage') {
      item.biblePassageVerses.forEach((_, index) => {
        result.push({ item, type: 'verse', index })
      })
    } else if (item.itemType === 'slide') {
      if (item.slideType === 'versete_tineri') {
        item.verseteTineriEntries.forEach((_, index) => {
          result.push({ item, type: 'entry', index })
        })
      } else if (item.slideType === 'scene') {
        result.push({ item, type: 'scene', index: 0 })
      } else {
        result.push({ item, type: 'announcement', index: 0 })
      }
    }
  })

  return result
}

/**
 * Where each program item starts in the flat list, keyed by item id. Sub-item
 * rows add their own offset to this to know their absolute flat index.
 */
export function buildItemStartFlatIndex(
  items: ScheduleItem[],
): Record<number, number> {
  const map: Record<number, number> = {}
  let flatIndex = 0

  items.forEach((item) => {
    map[item.id] = flatIndex
    flatIndex += countScheduleItemSteps(item)
  })

  return map
}
