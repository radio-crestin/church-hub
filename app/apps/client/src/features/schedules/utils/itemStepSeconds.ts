import { midiVerseTimes } from './midiVerseTimes'
import { buildScheduleFlatItems } from './scheduleFlatItems'
import { type AutoplayTiming, stepSeconds } from './stepSeconds'
import type { ScheduleItem } from '../types'

/**
 * The time each slide of an item stays up while the presentation runs: a
 * MIDI item's slides as long as their part of the music, as the server runs
 * them.
 */
export function itemStepSeconds(
  item: ScheduleItem,
  automation: AutoplayTiming,
): number[] {
  const { midi } = item
  if (!midi) {
    return buildScheduleFlatItems([item]).map((step) =>
      stepSeconds(step, automation),
    )
  }
  const times = midiVerseTimes({ ...item, midi })
  return times.map((start, index) =>
    Math.round((times[index + 1] ?? midi.durationSeconds) - start),
  )
}
