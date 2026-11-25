import type { ScheduleStep } from './buildScheduleSteps'
import { stepText } from './stepText'
import type { ScheduleAutomationSettings } from '../schedules/types'

/** A room reads about 180 words a minute off a screen. */
const WORDS_PER_SECOND = 3
/** Time to look up and find the start of a new slide. */
const LOOK_UP_SECONDS = 2

/**
 * How long a step stays up while its presentation runs by itself, like
 * PowerPoint's "advance after": the item's own time when it has one, else the
 * presentation's seconds per slide, longer for a slide with more text when
 * `autoplayByText` is on. Mirrored by the client's `stepSeconds`, which shows
 * the times beside each item.
 */
export function stepSeconds(
  step: ScheduleStep,
  automation: Pick<ScheduleAutomationSettings, 'autoplayByText'> & {
    autoplaySeconds: number
  },
): number {
  if (step.item.advanceSeconds != null) return step.item.advanceSeconds
  if (!automation.autoplayByText) return automation.autoplaySeconds
  const words = stepText(step).split(/\s+/).filter(Boolean).length
  return Math.max(
    automation.autoplaySeconds,
    Math.ceil(LOOK_UP_SECONDS + words / WORDS_PER_SECOND),
  )
}
