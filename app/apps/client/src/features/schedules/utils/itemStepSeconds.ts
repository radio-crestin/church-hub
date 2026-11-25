import { buildScheduleFlatItems } from './scheduleFlatItems'
import { type AutoplayTiming, stepSeconds } from './stepSeconds'
import type { ScheduleItem } from '../types'

/** The time each slide of an item stays up while the presentation runs. */
export function itemStepSeconds(
  item: ScheduleItem,
  automation: AutoplayTiming,
): number[] {
  return buildScheduleFlatItems([item]).map((step) =>
    stepSeconds(step, automation),
  )
}
