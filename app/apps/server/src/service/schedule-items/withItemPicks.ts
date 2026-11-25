import { pickedEntries, pickedVideo } from './itemPicks'
import { musicSummary } from './musicSummary'
import { pickSomeEntries } from './pickSomeEntries'
import { pickVerseEntries } from './pickVerseEntries'
import { pickVideo } from './pickVideo'
import type {
  MusicItemConfig,
  VersesItemConfig,
  VerseteItemConfig,
  VideoItemConfig,
} from './types'
import type { ScheduleItem } from '../schedules/types'

/**
 * Fills in what an item shows in the current run from its settings: a music
 * item's tracks, the video, the verses picked at random. Items without
 * settings come back as they are.
 */
export function withItemPicks(item: ScheduleItem): ScheduleItem {
  const config = item.itemConfig
  if (!config) return item
  switch (item.itemType) {
    case 'music':
      return { ...item, music: musicSummary(config as MusicItemConfig) }
    case 'video':
      return {
        ...item,
        video: pickedVideo(item.id, config, () =>
          pickVideo(config as VideoItemConfig),
        ),
      }
    case 'verses':
      return {
        ...item,
        verseteTineriEntries: pickedEntries(item.id, config, () =>
          pickVerseEntries(config as VersesItemConfig),
        ),
      }
    case 'slide': {
      if (item.slideType !== 'versete_tineri') return item
      const all = item.verseteTineriEntries
      return {
        ...item,
        verseteTineriEntries: pickedEntries(item.id, [config, all], () =>
          pickSomeEntries(all, config as VerseteItemConfig),
        ),
      }
    }
    default:
      return item
  }
}
