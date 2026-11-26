import type {
  VersesItemConfig,
  VerseteItemConfig,
  VideoItemConfig,
} from './types'
import type { ScheduleItem } from '../types'

/** An item that shows something picked at random, again on each run and loop. */
export function isRandomItem(item: ScheduleItem): boolean {
  if (!item.itemConfig) return false
  if (item.itemType === 'video') {
    return (item.itemConfig as VideoItemConfig).source === 'random'
  }
  if (item.itemType === 'verses' || item.slideType === 'versete_tineri') {
    return !!(item.itemConfig as VersesItemConfig | VerseteItemConfig).count
  }
  return false
}
