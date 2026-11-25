import type { VideoItemConfig } from './types'
import type { ScheduleItem } from '../types'

/** A video item shown behind the steps after it instead of as a step. */
export function isBackgroundVideo(
  item: Pick<ScheduleItem, 'itemType' | 'itemConfig'>,
): boolean {
  return (
    item.itemType === 'video' &&
    (item.itemConfig as VideoItemConfig | null)?.background === true
  )
}
