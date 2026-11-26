import type { SlideDeck } from '~/features/slides-deck/types'
import { deckSteps } from '~/features/slides-deck/utils/deckSteps'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { flattenScheduleItems } from './flattenScheduleItems'
import { isBackgroundVideo } from '../media-items/isBackgroundVideo'
import type { ScheduleItem } from '../types'

/** Which kind of sub-item a flat entry points at. */
export type ScheduleFlatItemType =
  | 'slide'
  | 'verse'
  | 'entry'
  | 'announcement'
  | 'scene'
  | 'video'
  /** A Slides item's slide with its animations up to one click (deckSteps). */
  | 'deck'

/**
 * One presentable step of a program. A program item is rarely a single step:
 * a song is one step per (chorus-expanded) slide, a passage one per verse, a
 * Versete Tineri slide one per entry, a Slides deck one per slide and click.
 * Announcements and OBS scenes are a single step each.
 */
export interface ScheduleFlatItem {
  item: ScheduleItem
  type: ScheduleFlatItemType
  /** Index of this step *within* its program item. */
  index: number
}

/** How many presentable steps a single program item contributes. */
export function countScheduleItemSteps(item: ScheduleItem): number {
  // A presentation inside it: all of its steps.
  if (item.itemType === 'schedule') return buildScheduleFlatItems([item]).length
  if (item.itemType === 'song') {
    return expandSongSlidesWithChoruses(item.slides).length
  }
  if (item.itemType === 'bible_passage') {
    return item.biblePassageVerses.length
  }
  if (
    (item.itemType === 'slide' && item.slideType === 'versete_tineri') ||
    item.itemType === 'verses'
  ) {
    return item.verseteTineriEntries.length
  }
  // Music is no step: it starts as the presentation reaches the next one.
  if (item.itemType === 'music') return 0
  // A background video is no step either: it loops behind the next ones.
  if (item.itemType === 'video') {
    return item.video && !isBackgroundVideo(item) ? 1 : 0
  }
  // A deck: each slide, then each click of its animations.
  if (item.itemType === 'slides') {
    return deckSteps(item.itemConfig as SlideDeck).length
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

  // A presentation inside it runs its items in its place.
  flattenScheduleItems(items).forEach((item) => {
    if (item.itemType === 'song') {
      expandSongSlidesWithChoruses(item.slides).forEach((_, index) => {
        result.push({ item, type: 'slide', index })
      })
    } else if (item.itemType === 'bible_passage') {
      item.biblePassageVerses.forEach((_, index) => {
        result.push({ item, type: 'verse', index })
      })
    } else if (item.itemType === 'verses') {
      item.verseteTineriEntries.forEach((_, index) => {
        result.push({ item, type: 'entry', index })
      })
    } else if (item.itemType === 'video') {
      if (item.video && !isBackgroundVideo(item)) {
        result.push({ item, type: 'video', index: 0 })
      }
    } else if (item.itemType === 'slides') {
      deckSteps(item.itemConfig as SlideDeck).forEach((_, index) => {
        result.push({ item, type: 'deck', index })
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

  // A presentation inside it starts where its first item does; its items are
  // listed too, so their rows light up like the others.
  const walk = (list: ScheduleItem[], path: ReadonlySet<number>) => {
    for (const item of list) {
      map[item.id] = flatIndex
      const child = item.childSchedule
      if (item.itemType !== 'schedule') {
        flatIndex += countScheduleItemSteps(item)
      } else if (child && !path.has(child.id)) {
        walk(child.items, new Set(path).add(child.id))
      }
    }
  }
  walk(items, new Set())

  return map
}
