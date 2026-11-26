import { buildScheduleFlatItems } from './scheduleFlatItems'
import type { ScheduleItem, ScheduleItemMidi } from '../types'

/**
 * When each slide of a MIDI item starts in its music: as synced, else split
 * evenly, as the server runs it. Times synced for another number of slides
 * (the song was edited since) are split evenly too.
 */
export function midiVerseTimes(
  item: ScheduleItem & { midi: ScheduleItemMidi },
): number[] {
  const count = buildScheduleFlatItems([item]).length
  const { verseTimes, durationSeconds } = item.midi
  if (verseTimes?.length === count) return verseTimes
  return Array.from(
    { length: count },
    (_, index) => Math.round(((index * durationSeconds) / count) * 10) / 10,
  )
}
