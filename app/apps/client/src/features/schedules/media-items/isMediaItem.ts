import type { MediaItemType } from './types'
import type { ScheduleItem } from '../types'

/** A music, video or verses item: an item made only of its settings. */
export function isMediaItem(
  item: ScheduleItem,
): item is ScheduleItem & { itemType: MediaItemType } {
  return (
    item.itemType === 'music' ||
    item.itemType === 'video' ||
    item.itemType === 'verses'
  )
}
