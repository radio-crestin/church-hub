import { buildScheduleFlatItems } from './scheduleFlatItems'
import { type AutoplayTiming, stepSeconds } from './stepSeconds'
import type { ScheduleItem } from '../types'

/**
 * The time each slide of an item stays up while the presentation runs: a
 * MIDI item's slides as long as their part of the music (synced, else split
 * evenly), as the server runs them.
 */
export function itemStepSeconds(
  item: ScheduleItem,
  automation: AutoplayTiming,
): number[] {
  const steps = buildScheduleFlatItems([item])
  const midi = item.midi
  if (!midi) return steps.map((step) => stepSeconds(step, automation))
  const times =
    midi.verseTimes?.length === steps.length
      ? midi.verseTimes
      : steps.map((_, index) => (index * midi.durationSeconds) / steps.length)
  return times.map((start, index) =>
    Math.round((times[index + 1] ?? midi.durationSeconds) - start),
  )
}
