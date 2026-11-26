import { shuffle } from './shuffle'
import type { VerseteItemConfig } from './types'
import type { ScheduleVerseteTineriEntry } from '../schedules/types'

/** A Versete Biblice slide's passages this time: all, or `count` at random. */
export function pickSomeEntries(
  entries: ScheduleVerseteTineriEntry[],
  config: VerseteItemConfig | null,
): ScheduleVerseteTineriEntry[] {
  if (!config?.count) return entries
  return shuffle(entries).slice(0, config.count)
}
